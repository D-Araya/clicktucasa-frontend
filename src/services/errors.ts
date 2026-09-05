import { t } from '../i18n';

/**
 * Errores de negocio de ClickTuCasa.
 *
 * Cada clase es el equivalente TypeScript de una excepción de dominio del
 * backend Java (`domain.exception.*`) y se construye a partir del
 * `errorCode` que devuelve el `GlobalExceptionHandler`. Así el contrato de
 * errores se cierra de punta a punta: el backend clasifica, el frontend
 * reacciona con el mismo vocabulario y la persona ve un mensaje legible.
 */

/** Equivalente a `RaffleNotFoundException` (HTTP 404). */
export class RaffleNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RaffleNotFoundError';
  }
}

/** Equivalente a `TicketNotFoundException` (HTTP 404). */
export class TicketNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TicketNotFoundError';
  }
}

/** Equivalente a `TicketNotAvailableException` (HTTP 409). */
export class TicketNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TicketNotAvailableError';
  }
}

/** Equivalente a `InvalidRaffleOperationException` (HTTP 409 / 400). */
export class InvalidRaffleOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRaffleOperationError';
  }
}

/** Equivalente a `PaymentFailedException` (HTTP 402). */
export class PaymentFailedError extends Error {
  constructor(message: string = t('error.paymentDeclined')) {
    super(message);
    this.name = 'PaymentFailedError';
  }
}

/** Fallo de transporte: el backend no respondió o devolvió algo inesperado. */
export class ApiTransportError extends Error {
  readonly status: number;

  constructor(message: string, status: number = 0) {
    super(message);
    this.name = 'ApiTransportError';
    this.status = status;
  }
}
