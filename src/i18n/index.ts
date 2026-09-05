import { en, es, type TranslationKey } from './translations';

/**
 * Gestión de idiomas de ClickTuCasa.
 *
 * Tres decisiones sostienen este módulo:
 *
 * 1. **El diccionario español define el contrato.** `TranslationKey` se
 *    deriva de `es`, y `en` está tipado como `Record<TranslationKey,
 *    string>`. Una clave sin traducir no compila. No existe el
 *    `t('clave.inexistente')` que se cuela hasta producción.
 *
 * 2. **El idioma es estado global con suscripción.** La aplicación no usa
 *    framework, así que cambiar de idioma no puede depender de un árbol de
 *    componentes reactivo: `onLocaleChange` notifica y quien escucha
 *    vuelve a pintar la pantalla actual.
 *
 * 3. **El formato de números y fechas viaja con el idioma.** Traducir los
 *    textos y dejar los miles con punto en inglés sería una traducción a
 *    medias; `localeTag()` alimenta a `Intl` desde el mismo sitio.
 */

export type Locale = 'es' | 'en';

export const SUPPORTED_LOCALES: ReadonlyArray<{ code: Locale; label: string; flag: string }> = [
  { code: 'es', label: 'Español', flag: 'ES' },
  { code: 'en', label: 'English', flag: 'EN' },
];

const STORAGE_KEY = 'clicktucasa.locale';
const DEFAULT_LOCALE: Locale = 'es';

const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = { es, en };

/** Etiqueta BCP-47 que se le pasa a `Intl` para cada idioma. */
const INTL_TAGS: Record<Locale, string> = { es: 'es-CL', en: 'en-US' };

function isLocale(value: unknown): value is Locale {
  return value === 'es' || value === 'en';
}

/**
 * Idioma inicial, por orden de preferencia: lo que la persona eligió antes,
 * el idioma del navegador, y por último español.
 *
 * `localStorage` se lee dentro de un `try`: en modo privado o con las
 * cookies bloqueadas, el acceso lanza en vez de devolver `null`.
 */
function detectInitialLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) {
      return stored;
    }
  } catch {
    // Sin almacenamiento disponible: se sigue con la detección del navegador.
  }

  const browserLanguage = navigator.language.slice(0, 2).toLowerCase();
  return isLocale(browserLanguage) ? browserLanguage : DEFAULT_LOCALE;
}

let currentLocale: Locale = detectInitialLocale();

type LocaleListener = (locale: Locale) => void;
const listeners = new Set<LocaleListener>();

export function getLocale(): Locale {
  return currentLocale;
}

/** Etiqueta para `Intl`: `es-CL` o `en-US`. */
export function localeTag(): string {
  return INTL_TAGS[currentLocale];
}

/**
 * Cambia el idioma, lo recuerda y avisa a quien esté escuchando. No hace
 * nada si el idioma ya es el activo, para no forzar repintados inútiles.
 */
export function setLocale(locale: Locale): void {
  if (locale === currentLocale) {
    return;
  }
  currentLocale = locale;

  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // La preferencia no se podrá recordar entre visitas, pero la sesión
    // actual funciona igual: no es motivo para interrumpir a nadie.
  }

  applyDocumentLocale();
  listeners.forEach((listener) => listener(locale));
}

/** Suscribe un repintado al cambio de idioma. Devuelve cómo cancelarlo. */
export function onLocaleChange(listener: LocaleListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Valores admitidos en un marcador `{nombre}` de una traducción. */
export type TranslationParams = Readonly<Record<string, string | number>>;

/**
 * Devuelve el texto de `key` en el idioma activo, sustituyendo los
 * marcadores `{nombre}` por los valores de `params`.
 *
 *     t('card.sold', { count: '1.240' })   // "1.240 vendidos"
 */
export function t(key: TranslationKey, params?: TranslationParams): string {
  const template = DICTIONARIES[currentLocale][key];
  if (params === undefined) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Elige entre la forma singular y la plural de un texto.
 *
 * Ambas claves se pasan explícitamente en vez de derivar `${key}.one` con
 * una plantilla: así el compilador verifica que las dos existen, que es
 * justo la garantía que se perdería con la magia de cadenas.
 *
 *     plural('cart.heading.one', 'cart.heading.other', n, { count: formatNumber(n) })
 */
export function plural(
  one: TranslationKey,
  other: TranslationKey,
  count: number,
  params?: TranslationParams,
): string {
  return t(count === 1 ? one : other, params);
}

/**
 * Sincroniza el documento con el idioma activo.
 *
 * No basta con traducir lo que se ve: `<html lang>` es lo que usan los
 * lectores de pantalla para elegir la voz y el navegador para ofrecer la
 * traducción automática, y el `<title>` es lo que se lee en la pestaña y
 * en un marcador.
 */
function applyDocumentLocale(): void {
  document.documentElement.lang = currentLocale;
  document.title = t('app.title');

  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description !== null) {
    description.content = t('app.description');
  }
}

/** Aplica el idioma inicial al documento; se llama una vez, al arrancar. */
export function applyInitialLocale(): void {
  applyDocumentLocale();
}
