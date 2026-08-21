import { type Ticket, TicketStatus } from './ticket.model';

/**
 * Modelo de dominio de la rifa (Raffle), replicando el contrato del backend
 * Java (domain.entity.Raffle / domain.entity.RaffleStatus /
 * domain.valueobject.HouseAddress / domain.valueobject.HouseValue).
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
    throw new Error('La dirección de la vivienda no puede estar vacía.');
  }
  return { value: trimmed };
}

/**
 * Value object: valor tasado de la vivienda. Debe ser > 0.
 * `ufEquivalent` es opcional porque no toda tasación viene expresada
 * en UF desde el origen.
 */
export interface HouseValue {
  readonly amount: number;
  readonly ufEquivalent?: number;
}

export function createHouseValue(amount: number, ufEquivalent?: number): HouseValue {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('El valor de la vivienda debe ser un número mayor a 0.');
  }
  return { amount, ufEquivalent };
}

/** Certificación energética de la vivienda (unión de literales acotada). */
export type EnergyRating = 'A' | 'B' | 'C' | 'D';

/**
 * Ficha técnica del inmueble. Nótese la variedad de tipos primitivos:
 * números, booleanos y una unión de literales — nada de `string` sueltos.
 */
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

/** Resultado del sorteo, presente solo cuando la rifa está DRAWN. */
export interface RaffleWinner {
  readonly ticketNumber: number;
  readonly ownerId: string;
  readonly drawnAt: Date;
  readonly verificationHash: string;
}

/**
 * Rifa de una casa: entidad raíz (aggregate root). Agrega la lista completa
 * de boletos y protege, junto al servicio, el invariante `canBeDrawn()`.
 */
export interface Raffle {
  readonly id: string;
  readonly title: string;
  readonly tagline: string;
  readonly city: string;
  readonly region: string;
  readonly houseAddress: HouseAddress;
  readonly houseValue: HouseValue;
  readonly ticketPrice: number;
  readonly minTicketsToDraw: number;
  readonly imageUrl: string;
  readonly specs: HouseSpecs;
  readonly notary: NotaryCertification;
  readonly features: readonly string[];
  readonly endDate?: Date;
  tickets: Ticket[];
  status: RaffleStatus;
  winner?: RaffleWinner;
}

/** Boletos de una rifa filtrados por estado. */
export function getTicketsByStatus(raffle: Raffle, status: TicketStatus): Ticket[] {
  return raffle.tickets.filter((ticket) => ticket.status === status);
}

/**
 * Replica exactamente `Raffle.canBeDrawn()` del backend:
 * `status === ACTIVE && soldTickets.length >= minTicketsToDraw`.
 */
export function canBeDrawn(raffle: Raffle): boolean {
  const soldCount = getTicketsByStatus(raffle, TicketStatus.SOLD).length;
  return raffle.status === RaffleStatus.ACTIVE && soldCount >= raffle.minTicketsToDraw;
}

/** Resumen numérico de una rifa, usado por la UI sin recorrer la grilla completa. */
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

export function summarizeRaffle(raffle: Raffle): RaffleSummary {
  // Un solo recorrido: con 15.000 boletos por rifa, filtrar cuatro veces
  // sería innecesariamente costoso.
  let soldCount = 0;
  let reservedCount = 0;
  let availableCount = 0;

  for (const ticket of raffle.tickets) {
    if (ticket.status === TicketStatus.SOLD) {
      soldCount++;
    } else if (ticket.status === TicketStatus.RESERVED) {
      reservedCount++;
    } else {
      availableCount++;
    }
  }

  const totalCount = raffle.tickets.length;
  const soldPercentage = totalCount === 0 ? 0 : Math.round((soldCount / totalCount) * 100);

  return {
    soldCount,
    reservedCount,
    availableCount,
    totalCount,
    soldPercentage,
    minimumPercentage:
      totalCount === 0 ? 0 : Math.round((raffle.minTicketsToDraw / totalCount) * 100),
    canBeDrawn: raffle.status === RaffleStatus.ACTIVE && soldCount >= raffle.minTicketsToDraw,
    isSoldOut: availableCount === 0,
    // "Últimos boletos" es un estado DERIVADO de los contadores, no un
    // valor extra del enum: el contrato con el backend queda intacto.
    isEndingSoon: soldPercentage >= 80 && availableCount > 0,
  };
}

/** Etiquetas legibles para el estado de una rifa (evita mostrar el enum crudo). */
export const RAFFLE_STATUS_LABELS: Record<RaffleStatus, string> = {
  [RaffleStatus.ACTIVE]: 'Activa',
  [RaffleStatus.DRAWN]: 'Sorteada',
  [RaffleStatus.CANCELLED]: 'Cancelada',
};

/** Criterios de ordenamiento disponibles en el catálogo. */
export enum RaffleSortOrder {
  POPULAR = 'POPULAR',
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  VALUE_DESC = 'VALUE_DESC',
  ENDING_SOON = 'ENDING_SOON',
}

export const RAFFLE_SORT_LABELS: Record<RaffleSortOrder, string> = {
  [RaffleSortOrder.POPULAR]: 'Más vendidas',
  [RaffleSortOrder.PRICE_ASC]: 'Boleto: menor precio',
  [RaffleSortOrder.PRICE_DESC]: 'Boleto: mayor precio',
  [RaffleSortOrder.VALUE_DESC]: 'Tasación más alta',
  [RaffleSortOrder.ENDING_SOON]: 'Sorteo más próximo',
};
