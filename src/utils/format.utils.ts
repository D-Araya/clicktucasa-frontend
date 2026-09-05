import { localeTag, plural, t } from '../i18n';

/**
 * Utilidades de formateo compartidas por los componentes visuales.
 *
 * Todas leen el idioma activo en el momento de la llamada, nunca al
 * importarse: traducir los textos y dejar los miles con separador chileno
 * en inglés sería una localización a medias. La moneda sigue siendo CLP en
 * los dos idiomas, porque el precio es real y no se convierte; lo que
 * cambia es cómo se escribe.
 */

/** Formatea un monto en pesos chilenos, ej. `$185.000.000` / `CLP 185,000,000`. */
export function formatCurrencyCLP(amount: number): string {
  return new Intl.NumberFormat(localeTag(), {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Versión compacta para cifras grandes, ej. `$185,0M` / `CLP 185M`. */
export function formatCurrencyCompact(amount: number): string {
  return new Intl.NumberFormat(localeTag(), {
    style: 'currency',
    currency: 'CLP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

/** Formatea un entero con separadores de miles, ej. `14.200` / `14,200`. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(localeTag()).format(value);
}

/**
 * Formatea un valor en Unidades de Fomento, ej. `4.620 UF`.
 * La UF es una unidad chilena: la sigla no se traduce, solo el número.
 */
export function formatUF(value: number): string {
  return `${new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 0 }).format(value)} UF`;
}

/** Formatea un folio de boleto con ceros a la izquierda, ej. `#00042`. */
export function formatTicketNumber(number: number): string {
  return `#${String(number).padStart(5, '0')}`;
}

/** Formatea una fecha legible, con guardia contra fechas inválidas. */
export function formatDate(date?: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return t('date.pending');
  }
  return date.toLocaleDateString(localeTag(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Formatea una fecha y hora legibles. */
export function formatDateTime(date?: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return t('date.unavailable');
  }
  return date.toLocaleString(localeTag(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Días que faltan para una fecha, o `null` si la fecha no es utilizable. */
export function daysUntil(date?: Date): number | null {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }
  const millisecondsPerDay = 86_400_000;
  return Math.ceil((date.getTime() - Date.now()) / millisecondsPerDay);
}

/** Texto legible de cuánto falta para el sorteo. */
export function formatCountdown(date?: Date): string {
  const days = daysUntil(date);
  if (days === null) {
    return t('date.pending');
  }
  if (days < 0) {
    return t('countdown.closed');
  }
  if (days === 0) {
    return t('countdown.today');
  }
  if (days === 1) {
    return t('countdown.tomorrow');
  }
  return t('countdown.days', { count: formatNumber(days) });
}

/** Une una lista de folios respetando la conjunción del idioma activo. */
export function formatTicketList(numbers: readonly number[]): string {
  const labels = numbers.map(formatTicketNumber);
  return new Intl.ListFormat(localeTag(), { style: 'long', type: 'conjunction' }).format(labels);
}

/** Extrae el mensaje legible de un error desconocido (`catch (error: unknown)`). */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return t('error.unexpected');
}

// `plural` se reexporta desde aquí porque casi todos los textos que lo
// necesitan viven junto a un número ya formateado.
export { plural };
