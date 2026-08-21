/**
 * Modelo de dominio del boleto (Ticket), replicando el contrato del backend
 * Java (domain.entity.Ticket / domain.entity.TicketStatus / domain.valueobject.TicketPrice).
 */

/**
 * Estados posibles de un boleto. Enum estricto, idéntico al del backend:
 * nunca se controla este estado con un `string` libre (Pilar 1).
 *
 * Ojo: la "selección" del usuario NO es un estado del boleto — es estado
 * de la interfaz, y por eso vive en la cesta del componente, no aquí.
 */
export enum TicketStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD',
}

/** Etiquetas legibles para el estado de un boleto. */
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.AVAILABLE]: 'Disponible',
  [TicketStatus.RESERVED]: 'Reservado',
  [TicketStatus.SOLD]: 'Vendido',
};

/**
 * Value object: precio de un boleto. Debe ser siempre > 0 (la misma regla
 * que protege el `record TicketPrice` del backend). Se valida al construirlo
 * con `createTicketPrice`, nunca se instancia el literal directamente fuera
 * de la capa de servicio/dominio.
 */
export interface TicketPrice {
  readonly amount: number;
}

export function createTicketPrice(amount: number): TicketPrice {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('El precio del boleto debe ser un número mayor a 0.');
  }
  return { amount };
}

/**
 * Boleto numerado de una rifa. `ownerId` y `reservedUntil` son opcionales
 * porque solo tienen sentido una vez que el boleto deja de estar AVAILABLE.
 */
export interface Ticket {
  readonly number: number;
  readonly price: TicketPrice;
  status: TicketStatus;
  ownerId?: string;
  reservedUntil?: Date;
}

/**
 * Guardia de tipo: determina si una reserva ya venció, replicando
 * `Ticket.isReservationExpired(currentTime)` del backend. Devuelve `false`
 * si el boleto no está RESERVED o no tiene `reservedUntil` — igual que en Java.
 */
export function isReservationExpired(ticket: Ticket, now: Date = new Date()): boolean {
  if (ticket.status !== TicketStatus.RESERVED || !ticket.reservedUntil) {
    return false;
  }
  return now.getTime() > ticket.reservedUntil.getTime();
}
