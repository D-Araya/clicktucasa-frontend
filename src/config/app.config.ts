/**
 * Configuración global de ClickTuCasa Frontend.
 *
 * Centraliza el origen de datos, las constantes de la capa de "resiliencia
 * de red" (latencia y probabilidad de fallo simulados) y los límites de
 * negocio que el frontend valida de forma temprana, antes de llamar al
 * servicio.
 */
export const APP_CONFIG = {
  /**
   * Origen de datos del catálogo de rifas.
   *
   * Hoy apunta a un archivo estático servido por Vite desde `public/`, que
   * se consume con `fetch()` exactamente igual que un endpoint REST. En el
   * Hito 4 basta con reemplazar esta URL por la del backend Spring Boot
   * (p. ej. `http://localhost:8080/api/v1/raffles`) — el resto del código
   * no cambia.
   */
  RAFFLES_DATA_URL: './data/raffles.json',

  /** Latencia artificial (ms) para que los estados de carga sean visibles. */
  SIMULATED_NETWORK_DELAY_MS: 600,

  /**
   * Probabilidad (0 a 1) de que una operación falle con un error de
   * "servidor simulado". Permanece activa siempre, a baja intensidad, para
   * poder evidenciar que el try/catch y el estado de error visual funcionan
   * de verdad en los cinco flujos.
   */
  SIMULATED_NETWORK_ERROR_RATE: 0.08,

  /**
   * Probabilidad (0 a 1) de que la pasarela de pago simulada rechace un
   * cobro al comprar un boleto (equivalente a `PaymentFailedException`
   * del backend cuando `PaymentGateway.processPayment(...)` retorna false).
   */
  SIMULATED_PAYMENT_FAILURE_RATE: 0.25,

  /** Duración mínima permitida para una reserva de boleto, en minutos. */
  MIN_RESERVATION_MINUTES: 1,

  /** Duración máxima permitida para una reserva de boleto, en minutos. */
  MAX_RESERVATION_MINUTES: 60,

  /** Valor sugerido por defecto en el formulario de reserva. */
  DEFAULT_RESERVATION_MINUTES: 15,

  /** Cantidad de boletos que se muestran por página en la grilla. */
  TICKET_PAGE_SIZE: 200,
} as const;

/**
 * Parámetros de emisión de una rifa.
 *
 * ⚠️ HARDCODEADO POR AHORA (Hito 2): toda rifa emite 15.000 boletos y
 * requiere 14.000 vendidos para poder sortearse. El backend todavía no
 * expone estos valores por rifa.
 *
 * TODO (Hito 4): eliminar estas constantes y leer `totalTickets` y
 * `minTicketsToDraw` desde la respuesta del backend, validándolos en
 * `RaffleService.mapRaffle()` igual que el resto de los campos.
 */
export const RAFFLE_DEFAULTS = {
  /** Boletos emitidos por rifa. */
  TOTAL_TICKETS: 15_000,

  /** Boletos que deben venderse para habilitar el sorteo (`canBeDrawn()`). */
  MIN_TICKETS_TO_DRAW: 14_000,
} as const;
