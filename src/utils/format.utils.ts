/** Utilidades de formateo compartidas por los componentes visuales. */

/** Formatea un monto en pesos chilenos, ej. `$185.000.000`. */
export function formatCurrencyCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Versión compacta para cifras grandes, ej. `$185,0M`. */
export function formatCurrencyCompact(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toLocaleString('es-CL', { maximumFractionDigits: 1 })}M`;
  }
  return formatCurrencyCLP(amount);
}

/** Formatea un entero con separadores de miles, ej. `14.200`. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CL').format(value);
}

/** Formatea un valor en Unidades de Fomento, ej. `4.620 UF`. */
export function formatUF(value: number): string {
  return `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(value)} UF`;
}

/** Formatea un folio de boleto con ceros a la izquierda, ej. `#00042`. */
export function formatTicketNumber(number: number): string {
  return `#${String(number).padStart(5, '0')}`;
}

/** Formatea una fecha legible en español, con guardia contra fechas inválidas. */
export function formatDate(date?: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return 'Fecha por confirmar';
  }
  return date.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Formatea una fecha/hora legible en español. */
export function formatDateTime(date?: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return 'Fecha no disponible';
  }
  return date.toLocaleString('es-CL', {
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
    return 'Fecha por confirmar';
  }
  if (days < 0) {
    return 'Sorteo cerrado';
  }
  if (days === 0) {
    return 'Sorteo hoy';
  }
  if (days === 1) {
    return 'Sorteo mañana';
  }
  return `Sorteo en ${formatNumber(days)} días`;
}

/** Extrae el mensaje legible de un error desconocido (catch (error: unknown)). */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Ocurrió un error inesperado.';
}
