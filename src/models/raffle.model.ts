import { type Ticket, TicketStatus } from './ticket.model';
import { t } from '../i18n';

/**
 * Modelo de dominio de la rifa, alineado campo por campo con el contrato
 * real del backend Spring Boot:
 *
 *   GET /api/v1/raffles        -> RaffleSummaryResponse[]  (catálogo)
 *   GET /api/v1/raffles/{id}   -> RaffleResponse           (detalle)
 *
 * El catálogo NO trae la grilla de boletos: una rifa puede emitir decenas
 * de miles, y la tarjeta solo necesita los contadores. Por eso el modelo se
 * parte en dos: `RaffleCatalogItem` (lo que llega en el listado) y
 * `Raffle`, que agrega `tickets` y solo existe en la vista de detalle.
 */

/**
 * Estados posibles de una rifa. Son EXACTAMENTE los tres del enum
 * `RaffleStatus` del backend: no se inventan estados nuevos en el
 * frontend, porque eso rompería el contrato entre ambos lados.
 * Situaciones como "agotada" o "últimos boletos" se derivan de los
 * contadores (ver `summarizeRaffle`), nunca de un estado extra.
 */
export enum RaffleStatus {
  ACTIVE = 'ACTIVE',
  DRAWN = 'DRAWN',
  CANCELLED = 'CANCELLED',
}

/** Value object: dirección de la vivienda. No puede estar vacía. */
export interface HouseAddress {
  readonly value: string;
}

export function createHouseAddress(value: string): HouseAddress {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(t('error.invalidAddress'));
  }
  return { value: trimmed };
}

/**
 * Value object: valor tasado de la vivienda. Debe ser > 0.
 * `ufEquivalent` es opcional porque el backend no lo expone hoy.
 */
export interface HouseValue {
  readonly amount: number;
  readonly ufEquivalent?: number;
}

export function createHouseValue(amount: number, ufEquivalent?: number): HouseValue {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(t('error.invalidHouseValue'));
  }
  return { amount, ufEquivalent };
}

/** Certificación energética de la vivienda (unión de literales acotada). */
export type EnergyRating = 'A' | 'B' | 'C' | 'D';

/** Ficha técnica del inmueble. */
export interface HouseSpecs {
  readonly bedrooms: number;
  readonly bathrooms: number;
  readonly areaSqM: number;
  readonly yearBuilt: number;
  readonly hasPool: boolean;
  readonly hasGarage: boolean;
  readonly energyRating: EnergyRating;
}

/** Datos de la certificación notarial que respalda la rifa. */
export interface NotaryCertification {
  readonly notaryOffice: string;
  readonly cbrRegistration: string;
  readonly siiFiscalRole: string;
  readonly protocolNumber: string;
  readonly isVerified: boolean;
}

/**
 * Resultado del sorteo, presente solo cuando la rifa está DRAWN.
 *
 * El backend expone `winnerTicketNumber`; el resto de los campos son
 * opcionales porque solo pueden deducirse cuando se tiene la grilla de
 * boletos (vista de detalle).
 */
export interface RaffleWinner {
  readonly ticketNumber: number;
  readonly ownerId?: string;
}

/**
 * Campos comunes al catálogo y al detalle.
 *
 * Los marcados como "presentación" son opcionales de forma deliberada: el
 * backend no los expone, así que la interfaz los omite en lugar de
 * rellenarlos con valores por defecto genéricos. Cada componente decide
 * si los pinta comprobando su presencia; el día que el backend los emita,
 * aparecen solos sin tocar una línea de la UI.
 */
export interface RaffleBase {
  readonly id: string;
  readonly title: string;
  readonly houseAddress: HouseAddress;
  readonly houseValue: HouseValue;
  readonly ticketPrice: number;
  readonly totalTickets: number;
  readonly minTicketsToDraw: number;
  readonly soldTickets: number;
  readonly reservedTickets: number;
  readonly availableTickets: number;
  readonly status: RaffleStatus;
  readonly winner?: RaffleWinner;

  // ── Presentación: hoy no vienen del backend ──────────────────
  readonly tagline?: string;
  readonly city?: string;
  readonly region?: string;
  readonly imageUrl?: string;
  readonly endDate?: Date;
  readonly specs?: HouseSpecs;
  readonly notary?: NotaryCertification;
  readonly features?: readonly string[];
}

/** Un elemento del catálogo: sin grilla de boletos. */
export type RaffleCatalogItem = RaffleBase;

/** Rifa completa: lo que devuelve `GET /api/v1/raffles/{id}`. */
export interface Raffle extends RaffleBase {
  readonly tickets: readonly Ticket[];
}

/** Boletos de una rifa filtrados por estado. */
export function getTicketsByStatus(raffle: Raffle, status: TicketStatus): Ticket[] {
  return raffle.tickets.filter((ticket) => ticket.status === status);
}

/**
 * Replica exactamente `Raffle.canBeDrawn()` del backend:
 * `status === ACTIVE && soldTickets >= minTicketsToDraw`.
 *
 * La autoridad real sigue siendo el dominio Java; esto solo evita ofrecer
 * un botón que el backend va a rechazar.
 */
export function canBeDrawn(raffle: RaffleBase): boolean {
  return raffle.status === RaffleStatus.ACTIVE && raffle.soldTickets >= raffle.minTicketsToDraw;
}

/** Resumen numérico de una rifa, usado por la UI. */
export interface RaffleSummary {
  readonly soldCount: number;
  readonly reservedCount: number;
  readonly availableCount: number;
  readonly totalCount: number;
  readonly soldPercentage: number;
  readonly minimumPercentage: number;
  readonly canBeDrawn: boolean;
  readonly isSoldOut: boolean;
  readonly isEndingSoon: boolean;
}

/**
 * Los contadores llegan ya calculados desde el backend
 * (`availableTickets` / `reservedTickets` / `soldTickets`), así que la UI
 * no recorre la grilla: en el catálogo ni siquiera la tiene.
 */
export function summarizeRaffle(raffle: RaffleBase): RaffleSummary {
  const { soldTickets: soldCount, reservedTickets: reservedCount, availableTickets: availableCount } = raffle;
  const totalCount = raffle.totalTickets;
  const soldPercentage = totalCount === 0 ? 0 : Math.round((soldCount / totalCount) * 100);

  return {
    soldCount,
    reservedCount,
    availableCount,
    totalCount,
    soldPercentage,
    minimumPercentage:
      totalCount === 0 ? 0 : Math.round((raffle.minTicketsToDraw / totalCount) * 100),
    canBeDrawn: canBeDrawn(raffle),
    isSoldOut: availableCount === 0,
    // "Últimos boletos" es un estado DERIVADO de los contadores, no un
    // valor extra del enum: el contrato con el backend queda intacto.
    isEndingSoon: soldPercentage >= 80 && availableCount > 0,
  };
}

/**
 * Etiqueta legible del estado de una rifa (evita mostrar el enum crudo).
 *
 * Es una función y no un mapa constante a propósito: un `Record` se
 * evaluaría una sola vez, al importar el módulo, y se quedaría congelado
 * en el idioma que estuviera activo entonces.
 */
export function raffleStatusLabel(status: RaffleStatus): string {
  switch (status) {
    case RaffleStatus.ACTIVE:
      return t('raffle.active');
    case RaffleStatus.DRAWN:
      return t('raffle.drawn');
    case RaffleStatus.CANCELLED:
      return t('raffle.cancelled');
  }
}

/** Criterios de ordenamiento disponibles en el catálogo. */
export enum RaffleSortOrder {
  POPULAR = 'POPULAR',
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  VALUE_DESC = 'VALUE_DESC',
  ENDING_SOON = 'ENDING_SOON',
}

export function raffleSortLabel(order: RaffleSortOrder): string {
  switch (order) {
    case RaffleSortOrder.POPULAR:
      return t('sort.popular');
    case RaffleSortOrder.PRICE_ASC:
      return t('sort.priceAsc');
    case RaffleSortOrder.PRICE_DESC:
      return t('sort.priceDesc');
    case RaffleSortOrder.VALUE_DESC:
      return t('sort.valueDesc');
    case RaffleSortOrder.ENDING_SOON:
      return t('sort.endingSoon');
  }
}
