/**
 * Configuración global de ClickTuCasa Frontend.
 *
 * Un único lugar decide contra qué backend habla la aplicación y qué
 * límites valida el cliente antes de gastar una petición.
 */

/**
 * Origen del microservicio Spring Boot.
 *
 * Se lee de `VITE_API_URL` (ver `.env.example`) con un valor por defecto
 * que corresponde al puerto estándar del backend en local, para que un
 * clon recién bajado funcione sin configurar nada. Nunca se escribe una
 * URL absoluta en el código de los servicios.
 */
const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export const APP_CONFIG = {
  /** Base de todos los recursos de rifas. */
  RAFFLES_ENDPOINT: `${API_BASE_URL}/api/v1/raffles`,

  /** Duración mínima permitida para una reserva de boleto, en minutos. */
  MIN_RESERVATION_MINUTES: 1,

  /** Duración máxima permitida para una reserva de boleto, en minutos. */
  MAX_RESERVATION_MINUTES: 60,

  /** Valor sugerido por defecto en el formulario de reserva. */
  DEFAULT_RESERVATION_MINUTES: 15,

  /** Cantidad de boletos que se muestran por página en la grilla. */
  TICKET_PAGE_SIZE: 200,
} as const;
