import {
  type Raffle,
  RaffleStatus,
  type Ticket,
  type TicketPrice,
  TicketStatus,
  type HouseSpecs,
  type NotaryCertification,
  type RaffleWinner,
  type EnergyRating,
  createHouseAddress,
  createHouseValue,
  createTicketPrice,
  canBeDrawn,
  isReservationExpired,
} from '../models';
import type {
  ReserveTicketRequest,
  PurchaseTicketRequest,
  DrawWinnerResult,
  BatchTicketResult,
} from '../models/requests.model';
import { APP_CONFIG, RAFFLE_DEFAULTS } from '../config/app.config';
import { getErrorMessage } from '../utils/format.utils';
import {
  RaffleNotFoundError,
  TicketNotFoundError,
  TicketNotAvailableError,
  InvalidRaffleOperationError,
  PaymentFailedError,
  SimulatedServerError,
} from './errors';

// ─────────────────────────────────────────────────────────────────────
// Guardias y lectores de datos externos.
//
// `response.json()` devuelve datos sobre los que el frontend no tiene
// ninguna garantía. En vez de "creerle" al compilador con un cast, cada
// campo se lee desde `unknown` y se reconstruye con su tipo real y un
// valor por defecto razonable. Es la frontera exacta entre "el mundo
// externo" y el dominio estrictamente tipado de la aplicación.
// ─────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string, fallback: string): string {
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function readNumber(source: Record<string, unknown>, key: string, fallback: number): number {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readOptionalNumber(
  source: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = source[key];
  return typeof value === 'boolean' ? value : fallback;
}

function readStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function readNestedRecord(
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = source[key];
  return isRecord(value) ? value : {};
}

function readOptionalDate(source: Record<string, unknown>, key: string): Date | undefined {
  const value = source[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

function readRaffleStatus(source: Record<string, unknown>, key: string): RaffleStatus {
  const value = source[key];
  const allowedValues: string[] = Object.values(RaffleStatus);
  return typeof value === 'string' && allowedValues.includes(value)
    ? (value as RaffleStatus)
    : RaffleStatus.ACTIVE;
}

function readEnergyRating(source: Record<string, unknown>, key: string): EnergyRating {
  const value = source[key];
  const allowedValues: readonly string[] = ['A', 'B', 'C', 'D'];
  return typeof value === 'string' && allowedValues.includes(value)
    ? (value as EnergyRating)
    : 'C';
}

/**
 * `RaffleService` — capa de acceso a datos de ClickTuCasa.
 *
 * IMPORTANTE: esta clase es la implementación real y definitiva de las
 * operaciones de negocio de este hito, no un arnés de pruebas.
 *
 * El catálogo de rifas se obtiene con `fetch()` desde una fuente externa
 * al bundle (`public/data/raffles.json`, servida por Vite como si fuera un
 * endpoint REST), validando el canal (`response.ok`) y la forma del payload
 * (`Array.isArray`) antes de confiar en él. Las escrituras (reservar,
 * comprar, sortear) aplican las reglas de negocio y se conservan en memoria
 * porque el backend (Hito 4, Spring Boot) todavía no expone endpoints de
 * escritura.
 *
 * El día que exista ese backend, solo cambia el interior de estos métodos
 * (la URL y los verbos HTTP): la firma pública (`async ... : Promise<T>`)
 * es idéntica, así que ningún componente ni vista necesita cambiar.
 */
export class RaffleService {
  /**
   * Rifas que el usuario ya modificó en esta sesión. Tienen precedencia
   * sobre lo que responde el "backend", porque representan el estado más
   * reciente de la operación que la persona acaba de ejecutar.
   */
  private static readonly mutatedRaffles = new Map<string, Raffle>();

  // ─────────────────────────────────────────────────────────────────
  // Flujo 1: listar el catálogo
  // ─────────────────────────────────────────────────────────────────

  static async getAllRaffles(): Promise<Raffle[]> {
    const catalog = await this.loadCatalog();
    this.releaseExpiredReservations(catalog);
    return catalog.map((raffle) => this.cloneRaffle(raffle));
  }

  // ─────────────────────────────────────────────────────────────────
  // Flujo 2: detalle de una rifa (con su grilla de boletos)
  // ─────────────────────────────────────────────────────────────────

  static async getRaffleById(raffleId: string): Promise<Raffle> {
    const catalog = await this.loadCatalog();
    this.releaseExpiredReservations(catalog);

    const raffle = catalog.find((item) => item.id === raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(raffleId);
    }

    return this.cloneRaffle(raffle);
  }

  // ─────────────────────────────────────────────────────────────────
  // Flujo 3: reservar un boleto
  // ─────────────────────────────────────────────────────────────────

  static async reserveTicket(request: ReserveTicketRequest): Promise<Raffle> {
    await this.delay();
    this.maybeFailNetwork();

    const raffle = await this.getMutableRaffle(request.raffleId);
    this.assertRaffleIsActive(raffle, 'reservar');

    const ticket = this.findTicketOrThrow(raffle, request.ticketNumber);
    this.releaseIfExpired(ticket);

    if (ticket.status !== TicketStatus.AVAILABLE) {
      throw new TicketNotAvailableError(
        `El boleto #${request.ticketNumber} ya no está disponible (estado actual: ${ticket.status}).`,
      );
    }

    if (
      request.durationMinutes < APP_CONFIG.MIN_RESERVATION_MINUTES ||
      request.durationMinutes > APP_CONFIG.MAX_RESERVATION_MINUTES
    ) {
      throw new InvalidRaffleOperationError(
        `La duración de la reserva debe estar entre ${APP_CONFIG.MIN_RESERVATION_MINUTES} y ${APP_CONFIG.MAX_RESERVATION_MINUTES} minutos.`,
      );
    }

    ticket.status = TicketStatus.RESERVED;
    ticket.ownerId = request.userId;
    ticket.reservedUntil = new Date(Date.now() + request.durationMinutes * 60_000);

    return this.cloneRaffle(raffle);
  }

  // ─────────────────────────────────────────────────────────────────
  // Flujo 4: comprar un boleto (dispara el cobro simulado)
  // ─────────────────────────────────────────────────────────────────

  static async purchaseTicket(request: PurchaseTicketRequest): Promise<Raffle> {
    await this.delay();
    this.maybeFailNetwork();

    const raffle = await this.getMutableRaffle(request.raffleId);
    this.assertRaffleIsActive(raffle, 'comprar');

    const ticket = this.findTicketOrThrow(raffle, request.ticketNumber);
    this.releaseIfExpired(ticket);

    if (ticket.status === TicketStatus.SOLD) {
      throw new TicketNotAvailableError(`El boleto #${request.ticketNumber} ya fue vendido.`);
    }

    if (ticket.status === TicketStatus.RESERVED && ticket.ownerId !== request.userId) {
      throw new TicketNotAvailableError(
        `El boleto #${request.ticketNumber} está reservado por otro usuario.`,
      );
    }

    if (!this.processSimulatedPayment()) {
      throw new PaymentFailedError();
    }

    ticket.status = TicketStatus.SOLD;
    ticket.ownerId = request.userId;
    ticket.reservedUntil = undefined;

    return this.cloneRaffle(raffle);
  }

  // ─────────────────────────────────────────────────────────────────
  // Operaciones en lote sobre la cesta
  //
  // El backend expone un caso de uso POR BOLETO, así que la cesta se
  // resuelve orquestando N llamadas secuenciales. Cada boleto puede
  // fallar por su cuenta (lo tomó otro usuario, el pago fue rechazado),
  // por eso el resultado separa éxitos de fracasos en vez de abortar
  // todo el lote al primer error.
  // ─────────────────────────────────────────────────────────────────

  static async reserveTickets(
    raffleId: string,
    ticketNumbers: readonly number[],
    userId: string,
    durationMinutes: number,
  ): Promise<BatchTicketResult> {
    return this.runBatch(raffleId, ticketNumbers, (ticketNumber) =>
      this.reserveTicket({ raffleId, ticketNumber, userId, durationMinutes }),
    );
  }

  static async purchaseTickets(
    raffleId: string,
    ticketNumbers: readonly number[],
    buyer: Omit<PurchaseTicketRequest, 'raffleId' | 'ticketNumber'>,
  ): Promise<BatchTicketResult> {
    return this.runBatch(raffleId, ticketNumbers, (ticketNumber) =>
      this.purchaseTicket({ raffleId, ticketNumber, ...buyer }),
    );
  }

  private static async runBatch(
    raffleId: string,
    ticketNumbers: readonly number[],
    operation: (ticketNumber: number) => Promise<Raffle>,
  ): Promise<BatchTicketResult> {
    const succeeded: number[] = [];
    const failed: Array<{ ticketNumber: number; reason: string }> = [];
    let latestRaffle: Raffle | null = null;

    for (const ticketNumber of ticketNumbers) {
      try {
        latestRaffle = await operation(ticketNumber);
        succeeded.push(ticketNumber);
      } catch (error: unknown) {
        failed.push({ ticketNumber, reason: getErrorMessage(error) });
      }
    }

    // Si TODOS fallaron nunca llegamos a tener una rifa actualizada:
    // se vuelve a pedir para poder repintar con el estado real.
    const raffle = latestRaffle ?? (await this.getRaffleById(raffleId));

    return { raffle, succeeded, failed };
  }

  // ─────────────────────────────────────────────────────────────────
  // Flujo 5 (administrativo): sortear un ganador
  // ─────────────────────────────────────────────────────────────────

  static async drawWinner(raffleId: string): Promise<DrawWinnerResult> {
    await this.delay();
    this.maybeFailNetwork();

    const raffle = await this.getMutableRaffle(raffleId);

    if (!canBeDrawn(raffle)) {
      const soldCount = raffle.tickets.filter((t) => t.status === TicketStatus.SOLD).length;
      throw new InvalidRaffleOperationError(
        `La rifa "${raffle.title}" aún no cumple el mínimo de boletos vendidos para sortear ` +
          `(${soldCount}/${raffle.minTicketsToDraw}).`,
      );
    }

    const soldTickets = raffle.tickets.filter((t) => t.status === TicketStatus.SOLD);
    const winningIndex = Math.floor(Math.random() * soldTickets.length);
    const winnerTicket = soldTickets[winningIndex];

    if (!winnerTicket) {
      throw new InvalidRaffleOperationError('No fue posible determinar un boleto ganador.');
    }

    raffle.status = RaffleStatus.DRAWN;
    raffle.winner = {
      ticketNumber: winnerTicket.number,
      ownerId: winnerTicket.ownerId ?? 'Participante sin identificar',
      drawnAt: new Date(),
      verificationHash: this.generateVerificationHash(raffle.id, winnerTicket.number),
    };

    return {
      raffle: this.cloneRaffle(raffle),
      winnerTicket: { ...winnerTicket, price: { ...winnerTicket.price } },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Acceso a datos: fetch + validación de canal y de forma
  // ─────────────────────────────────────────────────────────────────

  private static async loadCatalog(): Promise<Raffle[]> {
    await this.delay();
    this.maybeFailNetwork();

    const catalogFromApi = await this.fetchRaffles();
    return catalogFromApi.map((raffle) => this.mutatedRaffles.get(raffle.id) ?? raffle);
  }

  /**
   * Las dos fases del desempaquetado asíncrono:
   *   1. Validación de canal — `response.ok` antes de leer el cuerpo.
   *   2. Conversión de payload — `response.json()` + validación de forma
   *      (`Array.isArray`) + mapeo estricto campo por campo.
   */
  private static async fetchRaffles(): Promise<Raffle[]> {
    const response = await fetch(APP_CONFIG.RAFFLES_DATA_URL);

    if (!response.ok) {
      throw new Error(
        `Error HTTP al obtener las rifas: status ${response.status} (${response.statusText}).`,
      );
    }

    const rawData: unknown = await response.json();

    if (!Array.isArray(rawData)) {
      throw new Error('La respuesta de rifas no tiene un formato válido (se esperaba un arreglo).');
    }

    return rawData.map((item, index) => this.mapRaffle(item, index));
  }

  /** Transforma un elemento crudo del payload en una entidad `Raffle` del dominio. */
  private static mapRaffle(item: unknown, index: number): Raffle {
    if (!isRecord(item)) {
      throw new Error(`La rifa en la posición ${index} no es un objeto válido.`);
    }

    const ticketPrice = readNumber(item, 'ticketPrice', 1);
    const soldTickets = readNumber(item, 'soldTickets', 0);
    const reservedTickets = readNumber(item, 'reservedTickets', 0);

    // ⚠️ Hardcodeado en el Hito 2: el backend todavía no expone estos dos
    // valores por rifa. Ver RAFFLE_DEFAULTS en config/app.config.ts.
    const totalTickets = RAFFLE_DEFAULTS.TOTAL_TICKETS;
    const minTicketsToDraw = RAFFLE_DEFAULTS.MIN_TICKETS_TO_DRAW;

    const status = readRaffleStatus(item, 'status');

    return {
      id: readString(item, 'id', `raffle-${index + 1}`),
      title: readString(item, 'title', 'Rifa sin título'),
      tagline: readString(item, 'tagline', ''),
      city: readString(item, 'city', 'Ciudad por confirmar'),
      region: readString(item, 'region', ''),
      houseAddress: createHouseAddress(readString(item, 'houseAddress', 'Dirección por confirmar')),
      houseValue: createHouseValue(
        readNumber(item, 'houseValue', 1),
        readOptionalNumber(item, 'houseValueUf'),
      ),
      ticketPrice,
      minTicketsToDraw,
      imageUrl: readString(item, 'imageUrl', ''),
      specs: this.mapSpecs(readNestedRecord(item, 'specs')),
      notary: this.mapNotary(readNestedRecord(item, 'notary')),
      features: readStringArray(item, 'features'),
      endDate: readOptionalDate(item, 'endDate'),
      tickets: this.materializeTickets(
        createTicketPrice(ticketPrice),
        totalTickets,
        soldTickets,
        reservedTickets,
      ),
      status,
      winner: this.mapWinner(item, status),
    };
  }

  private static mapSpecs(source: Record<string, unknown>): HouseSpecs {
    return {
      bedrooms: readNumber(source, 'bedrooms', 0),
      bathrooms: readNumber(source, 'bathrooms', 0),
      areaSqM: readNumber(source, 'areaSqM', 0),
      yearBuilt: readNumber(source, 'yearBuilt', 0),
      hasPool: readBoolean(source, 'hasPool', false),
      hasGarage: readBoolean(source, 'hasGarage', false),
      energyRating: readEnergyRating(source, 'energyRating'),
    };
  }

  private static mapNotary(source: Record<string, unknown>): NotaryCertification {
    return {
      notaryOffice: readString(source, 'notaryOffice', 'Notaría por confirmar'),
      cbrRegistration: readString(source, 'cbrRegistration', 'Sin inscripción'),
      siiFiscalRole: readString(source, 'siiFiscalRole', 'Sin rol'),
      protocolNumber: readString(source, 'protocolNumber', 'Sin repertorio'),
      isVerified: readBoolean(source, 'isVerified', false),
    };
  }

  private static mapWinner(
    item: Record<string, unknown>,
    status: RaffleStatus,
  ): RaffleWinner | undefined {
    if (status !== RaffleStatus.DRAWN) {
      return undefined;
    }

    const source = readNestedRecord(item, 'winner');
    const ticketNumber = readOptionalNumber(source, 'ticketNumber');
    if (ticketNumber === undefined) {
      return undefined;
    }

    return {
      ticketNumber,
      ownerId: readString(source, 'ownerId', 'Participante sin identificar'),
      drawnAt: readOptionalDate(source, 'drawnAt') ?? new Date(),
      verificationHash: readString(source, 'verificationHash', 'sin-hash'),
    };
  }

  /**
   * Construye la grilla completa de boletos a partir de los contadores que
   * entrega la API. Un backend real paginaría este recurso
   * (`GET /raffles/:id/tickets?page=n`); mientras eso no exista, el
   * frontend materializa el inventario y la grilla lo pagina en el cliente.
   */
  private static materializeTickets(
    price: TicketPrice,
    total: number,
    sold: number,
    reserved: number,
  ): Ticket[] {
    const soldCount = Math.max(0, Math.min(sold, total));
    const reservedCount = Math.max(0, Math.min(reserved, total - soldCount));
    const tickets: Ticket[] = new Array<Ticket>(total);

    for (let index = 0; index < total; index++) {
      const number = index + 1;

      if (index < soldCount) {
        tickets[index] = {
          number,
          price,
          status: TicketStatus.SOLD,
          ownerId: `comprador${number}@clicktucasa.cl`,
        };
      } else if (index < soldCount + reservedCount) {
        tickets[index] = {
          number,
          price,
          status: TicketStatus.RESERVED,
          ownerId: `interesado${number}@clicktucasa.cl`,
          reservedUntil: new Date(Date.now() + 15 * 60_000),
        };
      } else {
        tickets[index] = { number, price, status: TicketStatus.AVAILABLE };
      }
    }

    return tickets;
  }

  /**
   * Devuelve la instancia mutable de una rifa (la que vive en el mapa de
   * mutaciones), cargándola desde la API la primera vez que se toca.
   */
  private static async getMutableRaffle(raffleId: string): Promise<Raffle> {
    const alreadyMutated = this.mutatedRaffles.get(raffleId);
    if (alreadyMutated) {
      return alreadyMutated;
    }

    const catalogFromApi = await this.fetchRaffles();
    const raffle = catalogFromApi.find((item) => item.id === raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(raffleId);
    }

    this.mutatedRaffles.set(raffleId, raffle);
    return raffle;
  }

  // ─────────────────────────────────────────────────────────────────
  // Resiliencia de red (capa auxiliar, acotada)
  // ─────────────────────────────────────────────────────────────────

  private static delay(ms: number = APP_CONFIG.SIMULATED_NETWORK_DELAY_MS): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private static maybeFailNetwork(): void {
    if (Math.random() < APP_CONFIG.SIMULATED_NETWORK_ERROR_RATE) {
      throw new SimulatedServerError(
        'No fue posible comunicarse con el servidor. Intenta nuevamente.',
      );
    }
  }

  private static processSimulatedPayment(): boolean {
    return Math.random() >= APP_CONFIG.SIMULATED_PAYMENT_FAILURE_RATE;
  }

  // ─────────────────────────────────────────────────────────────────
  // Utilidades internas de dominio
  // ─────────────────────────────────────────────────────────────────

  private static assertRaffleIsActive(raffle: Raffle, action: string): void {
    if (raffle.status !== RaffleStatus.ACTIVE) {
      throw new InvalidRaffleOperationError(
        `La rifa "${raffle.title}" no está activa; no se pueden ${action} boletos.`,
      );
    }
  }

  private static findTicketOrThrow(raffle: Raffle, ticketNumber: number): Ticket {
    const ticket = raffle.tickets.find((t) => t.number === ticketNumber);
    if (!ticket) {
      throw new TicketNotFoundError(ticketNumber, raffle.id);
    }
    return ticket;
  }

  private static releaseIfExpired(ticket: Ticket): void {
    if (isReservationExpired(ticket)) {
      ticket.status = TicketStatus.AVAILABLE;
      ticket.ownerId = undefined;
      ticket.reservedUntil = undefined;
    }
  }

  /** Equivalente a `ReleaseExpiredReservationsUseCase` del backend. */
  private static releaseExpiredReservations(raffles: Raffle[]): void {
    for (const raffle of raffles) {
      for (const ticket of raffle.tickets) {
        this.releaseIfExpired(ticket);
      }
    }
  }

  /** Huella de verificación del acta de sorteo (determinista y trazable). */
  private static generateVerificationHash(raffleId: string, ticketNumber: number): string {
    const seed = `${raffleId}:${ticketNumber}:${Date.now()}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(12, '0').slice(0, 12);
  }

  private static cloneRaffle(raffle: Raffle): Raffle {
    return {
      ...raffle,
      houseAddress: { ...raffle.houseAddress },
      houseValue: { ...raffle.houseValue },
      tickets: raffle.tickets.map((ticket) => ({ ...ticket })),
    };
  }
}
