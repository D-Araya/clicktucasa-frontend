/**
 * Validaciones de formulario para el mercado chileno.
 *
 * Cada validador devuelve un `ValidationResult` en vez de un booleano
 * suelto: así el formulario puede mostrar el mensaje exacto del error y,
 * cuando corresponde, el valor ya normalizado (`formatted`).
 */

export interface ValidationResult {
  readonly isValid: boolean;
  readonly error?: string;
  readonly formatted?: string;
}

/**
 * Valida un RUT chileno con el algoritmo de Módulo 11.
 *
 * El dígito verificador NO es decorativo: es la única forma de detectar
 * un RUT mal tipeado sin consultar al Registro Civil — el equivalente,
 * en el frontend, a validar la estructura de un correo sin poder saber
 * si la casilla existe.
 */
export function validateRut(rut: string): ValidationResult {
  const cleaned = rut.replace(/[^0-9kK]/g, '').toUpperCase();

  if (cleaned.length === 0) {
    return { isValid: false, error: 'El RUT es obligatorio.' };
  }

  if (cleaned.length < 8 || cleaned.length > 9) {
    return { isValid: false, error: 'El RUT debe tener entre 8 y 9 caracteres.' };
  }

  const body = cleaned.slice(0, -1);
  const checkDigit = cleaned.slice(-1);

  if (!/^\d+$/.test(body)) {
    return { isValid: false, error: 'El cuerpo del RUT solo puede contener dígitos.' };
  }

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expectedDigit = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);

  if (checkDigit !== expectedDigit) {
    return { isValid: false, error: 'El dígito verificador del RUT no es correcto.' };
  }

  return { isValid: true, formatted: formatRut(cleaned) };
}

/** Devuelve el RUT con puntos y guion: `12.345.678-5`. */
export function formatRut(rut: string): string {
  const cleaned = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleaned.length <= 1) {
    return cleaned;
  }

  const body = cleaned.slice(0, -1);
  const checkDigit = cleaned.slice(-1);

  let formattedBody = '';
  for (let i = 0; i < body.length; i++) {
    const positionFromRight = body.length - i;
    formattedBody += body[i];
    if (positionFromRight > 1 && positionFromRight % 3 === 1) {
      formattedBody += '.';
    }
  }

  return `${formattedBody}-${checkDigit}`;
}

/** Valida un correo electrónico por estructura (nunca por existencia real). */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: 'El correo electrónico es obligatorio.' };
  }

  if ((trimmed.match(/@/g) ?? []).length !== 1) {
    return { isValid: false, error: 'El correo debe contener exactamente un símbolo @.' };
  }

  const emailPattern =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailPattern.test(trimmed)) {
    return { isValid: false, error: 'El formato del correo electrónico no es válido.' };
  }

  const domain = trimmed.split('@')[1] ?? '';
  const topLevelDomain = domain.split('.').pop() ?? '';

  if (topLevelDomain.length < 2) {
    return { isValid: false, error: 'El dominio del correo no es válido.' };
  }

  return { isValid: true, formatted: trimmed.toLowerCase() };
}

/** Valida un móvil chileno: nueve dígitos que empiezan en 9. */
export function validateChileanPhone(phone: string): ValidationResult {
  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: 'El teléfono es obligatorio.' };
  }

  let raw = trimmed;
  if (raw.startsWith('+56') || raw.startsWith('+ 56')) {
    raw = raw.replace(/^\+\s*56\s*/, '');
  }

  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('56') && digits.length >= 11) {
    digits = digits.slice(2);
  }

  if (digits.length === 0) {
    return { isValid: false, error: 'El teléfono es obligatorio.' };
  }

  if (digits.length !== 9) {
    return { isValid: false, error: 'El teléfono móvil debe tener 9 dígitos.' };
  }

  if (!digits.startsWith('9')) {
    return { isValid: false, error: 'El teléfono móvil debe comenzar con 9.' };
  }

  return {
    isValid: true,
    formatted: `+56 9 ${digits.slice(1, 5)} ${digits.slice(5)}`,
  };
}

/** Formatea progresivamente el teléfono mientras la persona escribe. */
export function formatChileanPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return '';
  }

  let raw = trimmed;
  if (raw.startsWith('+56') || raw.startsWith('+ 56')) {
    raw = raw.replace(/^\+\s*56\s*/, '');
  }

  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('56') && digits.length >= 11) {
    digits = digits.slice(2);
  }

  digits = digits.slice(0, 9);

  if (digits.length === 0) {
    return '';
  }
  if (digits.length <= 1) {
    return `+56 ${digits}`;
  }
  if (digits.length <= 5) {
    return `+56 ${digits.slice(0, 1)} ${digits.slice(1)}`;
  }
  return `+56 ${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5)}`;
}

/** Valida un nombre completo: al menos un nombre y un apellido. */
export function validateFullName(name: string): ValidationResult {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: 'El nombre completo es obligatorio.' };
  }

  if (trimmed.length < 5) {
    return { isValid: false, error: 'El nombre debe tener al menos 5 caracteres.' };
  }

  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(trimmed)) {
    return { isValid: false, error: 'El nombre solo puede contener letras.' };
  }

  const words = trimmed.split(/\s+/).filter((word) => word.length >= 2);
  if (words.length < 2) {
    return { isValid: false, error: 'Ingresa al menos un nombre y un apellido.' };
  }

  return { isValid: true, formatted: trimmed };
}

/** Valida un entero dentro de un rango cerrado. */
export function validateIntegerInRange(
  rawValue: string,
  min: number,
  max: number,
  fieldLabel: string,
): ValidationResult {
  const trimmed = rawValue.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: `${fieldLabel} es obligatorio.` };
  }

  // `parseInt("12abc")` devolvería 12, así que el formato se valida antes.
  if (!/^\d+$/.test(trimmed)) {
    return { isValid: false, error: `${fieldLabel} debe ser un número entero.` };
  }

  const parsed = parseInt(trimmed, 10);
  if (parsed < min || parsed > max) {
    return {
      isValid: false,
      error: `${fieldLabel} debe estar entre ${min.toLocaleString('es-CL')} y ${max.toLocaleString('es-CL')}.`,
    };
  }

  return { isValid: true, formatted: String(parsed) };
}
