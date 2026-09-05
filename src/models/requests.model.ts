import { t } from '../i18n';
import type { Raffle } from './raffle.model';
import type { Ticket } from './ticket.model';

/**
 * Contratos de entrada/salida de la capa de servicio (equivalentes a los
 * parámetros/retornos de los casos de uso del backend:
 * ReserveTicketUseCase, PurchaseTicketUseCase, DrawWinnerUseCase).
 */

/** Medios de pago aceptados. Enum estricto, nunca un `string` libre. */
export enum PaymentMethod {
  WEBPAY = 'WEBPAY',
  TRANSFER = 'TRANSFER',
  MACH = 'MACH',
  WALLET = 'WALLET',
}

export function paymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case PaymentMethod.WEBPAY:
      return t('payment.webpay');
    case PaymentMethod.TRANSFER:
      return t('payment.transfer');
    case PaymentMethod.MACH:
      return t('payment.mach');
    case PaymentMethod.WALLET:
      return t('payment.wallet');
  }
}

export interface ReserveTicketRequest {
  readonly raffleId: string;
  readonly ticketNumber: number;
  readonly userId: string;
  readonly durationMinutes: number;
}

export interface PurchaseTicketRequest {
  readonly raffleId: string;
  readonly ticketNumber: number;
  readonly userId: string;
  readonly buyerName: string;
  readonly buyerRut: string;
  readonly buyerPhone: string;
  readonly paymentMethod: PaymentMethod;
}

export interface DrawWinnerResult {
  readonly raffle: Raffle;
  readonly winnerTicket: Ticket;
}

/**
 * Resultado de una operación en lote sobre varios boletos.
 *
 * El backend expone un caso de uso POR BOLETO (`ReserveTicketUseCase`,
 * `PurchaseTicketUseCase`), así que la cesta se resuelve orquestando N
 * llamadas desde el frontend. Como cada una puede fallar por su cuenta
 * (boleto tomado por otro usuario, pago rechazado), el resultado
 * distingue explícitamente los éxitos de los fracasos en vez de asumir
 * que "todo o nada".
 */
export interface BatchTicketResult {
  readonly raffle: Raffle;
  readonly succeeded: readonly number[];
  readonly failed: ReadonlyArray<{ readonly ticketNumber: number; readonly reason: string }>;
}
