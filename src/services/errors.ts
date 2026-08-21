/**
 * Errores de negocio del servicio simulado de ClickTuCasa.
 *
 * Cada clase es el equivalente TypeScript de una excepción de dominio real
 * del backend Java (domain.exception.*). No son errores "de simulación":
 * representan reglas de negocio permanentes que el servicio aplica siempre
 * que corresponda, tal como lo haría el backend.
 */

/** Equivalente a `RaffleNotFoundException`. */
export class RaffleNotFoundError extends Error {
  constructor(raffleId: string) {
    super(`No se encontró una rifa con id "${raffleId}".`);
    this.name = 'RaffleNotFoundError';
  }
}

/** Equivalente a `TicketNotFoundException`. */
export class TicketNotFoundError extends Error {
  constructor(ticketNumber: number, raffleId: string) {
    super(`El boleto #${ticketNumber} no existe en la rifa "${raffleId}".`);
    this.name = 'TicketNotFoundError';
  }
}

/** Equivalente a `TicketNotAvailableException`. */
export class TicketNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TicketNotAvailableError';
  }
}

/** Equivalente a `InvalidRaffleOperationException`. */
export class InvalidRaffleOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRaffleOperationError';
  }
}

/** Equivalente a `PaymentFailedException`. */
export class PaymentFailedError extends Error {
  constructor(message: string = 'La pasarela de pago rechazó el cobro. Intenta nuevamente.') {
    super(message);
    this.name = 'PaymentFailedError';
  }
}

/** Error de la capa de resiliencia de red (servidor simulado caído/inestable). */
export class SimulatedServerError extends Error {
  constructor(message: string = 'Error de servidor simulado. Intenta nuevamente.') {
    super(message);
    this.name = 'SimulatedServerError';
  }
}
