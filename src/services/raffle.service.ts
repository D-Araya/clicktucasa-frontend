import { APP_CONFIG } from '../config/app.config';
import {
  type Raffle,
  type RaffleCatalogItem,
  type RaffleWinner,
  RaffleStatus,
  createHouseAddress,
  createHouseValue,
} from '../models/raffle.model';
import { type Ticket, TicketStatus, createTicketPrice } from '../models/ticket.model';
import type {
  BatchTicketResult,
  DrawWinnerResult,
  PurchaseTicketRequest,
  ReserveTicketRequest,
} from '../models/requests.model';
import {
  ApiTransportError,
  InvalidRaffleOperationError,
  PaymentFailedError,
  RaffleNotFoundError,
  TicketNotAvailableError,
} from './errors';
import { getErrorMessage } from '../utils/format.utils';
import { t } from '../i18n';

/**
 * Cliente HTTP del microservicio ClickTuCasa.
 *
 * Toda la lógica de negocio vive en el backend Java: aquí no se decide si
 * un boleto puede reservarse ni si un pago prospera, solo se traduce entre
 * el JSON de la API y el modelo tipado del frontend. El desempaquetado de
 * cada respuesta pasa por dos fases obligatorias, en este orden:
 *
 *   1. Validación de canal — `response.ok` ANTES de tocar el cuerpo.
 *      `fetch` no lanza ante un 404 ni un 500, solo ante un fallo de red;
 *      sin esta guarda un error del servidor se convertiría en un
 *      `undefined` que revienta más tarde, dentro del render.
 *   2. Validación de forma — `response.json()` y luego lectura campo por
 *      campo con guardias de tipo. Nada entra al modelo sin comprobarse.
 *
 * Los errores del backend llegan con el contrato `ErrorResponse`
 * ({ message, errorCode, timestamp }) que produce `GlobalExceptionHandler`,
 * y se reconstruyen aquí como la excepción de dominio equivalente.
 */

// ─────────────────────────────────────────────────────────────────
// Lectores estrictos: ningún `any`, ningún acceso sin comprobar
// ─────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ApiTransportError(t('error.badShape', { context }));
  }
  return value;
}

function readString(source: Record<string, unknown>, key: string, context: string): string {
  const value = source[key];
  if (typeof value !== 'string') {
    throw new ApiTransportError(t('error.notText', { field: key, context }));
  }
  return value;
}

function readNumber(source: Record<string, unknown>, key: string, context: string): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiTransportError(t('error.notNumber', { field: key, context }));
  }
  return value;
}

function readOptionalNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readOptionalString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readOptionalDate(source: Record<string, unknown>, key: string): Date | undefined {
  const value = source[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** El valor tiene que ser uno de los tres del enum del backend, sin excepción. */
function readRaffleStatus(source: Record<string, unknown>, key: string): RaffleStatus {
  const value = source[key];
  if (
    value === RaffleStatus.ACTIVE ||
    value === RaffleStatus.DRAWN ||
    value === RaffleStatus.CANCELLED
  ) {
    return value;
  }
  throw new ApiTransportError(t('error.unknownRaffleStatus', { value: String(value) }));
}

function readTicketStatus(source: Record<string, unknown>, key: string): TicketStatus {
  const value = source[key];
  if (
    value === TicketStatus.AVAILABLE ||
    value === TicketStatus.RESERVED ||
    value === TicketStatus.SOLD
  ) {
    return value;
  }
  throw new ApiTransportError(t('error.unknownTicketStatus', { value: String(value) }));
}

// ─────────────────────────────────────────────────────────────────
// Traducción de errores del backend a excepciones de dominio
// ─────────────────────────────────────────────────────────────────

async function toDomainError(response: Response): Promise<Error> {
  // El `.catch` cubre un error sin cuerpo JSON: sin él tendríamos un error
  // dentro del manejo de errores.
  const body: unknown = await response.json().catch(() => null);
  const payload = isRecord(body) ? body : {};
  const message = readOptionalString(payload, 'message') ?? t('error.http', { status: response.status });
  const errorCode = readOptionalString(payload, 'errorCode') ?? '';

  switch (errorCode) {
    case 'RESOURCE_NOT_FOUND':
      return new RaffleNotFoundError(message);
    case 'BUSINESS_RULE_VIOLATION':
      return new TicketNotAvailableError(message);
    case 'PAYMENT_FAILED':
      return new PaymentFailedError(message);
    case 'INVALID_INPUT':
    case 'VALIDATION_ERROR':
      return new InvalidRaffleOperationError(message);
    default:
      return new ApiTransportError(message, response.status);
  }
}

async function request(url: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error: unknown) {
    // Único caso en que `fetch` lanza: el servidor no está arriba o la red
    // cortó. Se distingue del error de negocio a propósito.
    throw new ApiTransportError(t('error.unreachable', { detail: getErrorMessage(error) }));
  }

  if (!response.ok) {
    throw await toDomainError(response);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function jsonPost(payload: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

// ─────────────────────────────────────────────────────────────────
// Mapeo del contrato JSON al modelo tipado
// ─────────────────────────────────────────────────────────────────

function mapTicket(raw: unknown): Ticket {
  const source = requireRecord(raw, t('context.ticket'));
  return {
    number: readNumber(source, 'number', t('context.ticket')),
    price: createTicketPrice(readNumber(source, 'price', t('context.ticket'))),
    status: readTicketStatus(source, 'status'),
    ownerId: readOptionalString(source, 'ownerId'),
    reservedUntil: readOptionalDate(source, 'reservedUntil'),
  };
}

/**
 * Campos comunes al catálogo y al detalle. Los de presentación (foto,
 * ciudad, ficha técnica, notaría) no existen en el contrato actual, así
 * que sencillamente no se inventan: quedan `undefined` y cada componente
 * decide si pinta ese bloque.
 */
function mapRaffleBase(source: Record<string, unknown>, context: string): RaffleCatalogItem {
  const status = readRaffleStatus(source, 'status');
  const winnerTicketNumber = readOptionalNumber(source, 'winnerTicketNumber');
  const winner: RaffleWinner | undefined =
    status === RaffleStatus.DRAWN && winnerTicketNumber !== undefined
      ? { ticketNumber: winnerTicketNumber }
      : undefined;

  return {
    id: readString(source, 'id', context),
    title: readString(source, 'title', context),
    houseAddress: createHouseAddress(readString(source, 'houseAddress', context)),
    houseValue: createHouseValue(readNumber(source, 'houseValue', context)),
    ticketPrice: readNumber(source, 'ticketPrice', context),
    totalTickets: readNumber(source, 'totalTickets', context),
    minTicketsToDraw: readNumber(source, 'minTicketsToDraw', context),
    soldTickets: readNumber(source, 'soldTickets', context),
    reservedTickets: readNumber(source, 'reservedTickets', context),
    availableTickets: readNumber(source, 'availableTickets', context),
    status,
    winner,
  };
}

function mapCatalogItem(raw: unknown): RaffleCatalogItem {
  return mapRaffleBase(requireRecord(raw, t('context.catalog')), t('context.catalog'));
}

function mapRaffle(raw: unknown): Raffle {
  const source = requireRecord(raw, t('context.raffle'));
  const base = mapRaffleBase(source, t('context.raffle'));

  const rawTickets = source['tickets'];
  if (!Array.isArray(rawTickets)) {
    throw new ApiTransportError(t('error.noTickets'));
  }
  const tickets = rawTickets.map(mapTicket);

  // El ganador solo puede identificarse por completo cuando se tiene la
  // grilla: el listado únicamente conoce el número del boleto.
  const winner: RaffleWinner | undefined =
    base.winner === undefined
      ? undefined
      : {
          ticketNumber: base.winner.ticketNumber,
          ownerId: tickets.find((ticket) => ticket.number === base.winner?.ticketNumber)?.ownerId,
        };

  return { ...base, winner, tickets };
}

// ─────────────────────────────────────────────────────────────────
// Servicio
// ─────────────────────────────────────────────────────────────────

export class RaffleService {
  /** Flujo 1 — catálogo: `GET /api/v1/raffles`. */
  static async getAllRaffles(): Promise<RaffleCatalogItem[]> {
    const data = await request(APP_CONFIG.RAFFLES_ENDPOINT);
    if (!Array.isArray(data)) {
      throw new ApiTransportError(t('error.catalogNotArray'));
    }
    return data.map(mapCatalogItem);
  }

  /** Flujo 2 — detalle: `GET /api/v1/raffles/{id}`. */
  static async getRaffleById(raffleId: string): Promise<Raffle> {
    const data = await request(`${APP_CONFIG.RAFFLES_ENDPOINT}/${encodeURIComponent(raffleId)}`);
    return mapRaffle(data);
  }

  /** Flujo 3 — reservar un boleto. Devuelve la rifa ya actualizada. */
  static async reserveTicket(request_: ReserveTicketRequest): Promise<Raffle> {
    const url =
      `${APP_CONFIG.RAFFLES_ENDPOINT}/${encodeURIComponent(request_.raffleId)}` +
      `/tickets/${request_.ticketNumber}/reservations`;
    const data = await request(
      url,
      jsonPost({ userId: request_.userId, durationMinutes: request_.durationMinutes }),
    );
    return mapRaffle(data);
  }

  /** Flujo 4 — comprar un boleto. El cobro lo resuelve el backend. */
  static async purchaseTicket(request_: PurchaseTicketRequest): Promise<Raffle> {
    const url =
      `${APP_CONFIG.RAFFLES_ENDPOINT}/${encodeURIComponent(request_.raffleId)}` +
      `/tickets/${request_.ticketNumber}/purchases`;
    const data = await request(url, jsonPost({ userId: request_.userId }));
    return mapRaffle(data);
  }

  /** Flujo 5 — sortear. El backend elige el ganador; aquí solo se recarga. */
  static async drawWinner(raffleId: string): Promise<DrawWinnerResult> {
    const url = `${APP_CONFIG.RAFFLES_ENDPOINT}/${encodeURIComponent(raffleId)}/draw`;
    const data = await request(url, jsonPost({}));
    const source = requireRecord(data, t('context.draw'));
    const winnerTicketNumber = readNumber(source, 'winnerTicketNumber', t('context.draw'));

    // El endpoint de sorteo devuelve solo el boleto ganador, así que se
    // recarga la rifa para repintar la grilla con su estado real.
    const raffle = await this.getRaffleById(raffleId);
    const winnerTicket = raffle.tickets.find((ticket) => ticket.number === winnerTicketNumber);
    if (!winnerTicket) {
      throw new ApiTransportError(t('error.winnerMissing', { number: winnerTicketNumber }));
    }

    return { raffle, winnerTicket };
  }

  // ─────────────────────────────────────────────────────────────
  // Operaciones en lote sobre la cesta
  //
  // El backend expone un caso de uso POR BOLETO, así que la cesta se
  // resuelve orquestando N llamadas secuenciales. Cada boleto puede
  // fallar por su cuenta (lo tomó otro usuario, el pago fue rechazado),
  // por eso el resultado separa éxitos de fracasos en vez de abortar
  // todo el lote al primer error.
  // ─────────────────────────────────────────────────────────────

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
}
