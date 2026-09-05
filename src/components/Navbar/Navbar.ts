import { renderIcon } from '../../utils/icon.utils';
import { getLocale, setLocale, SUPPORTED_LOCALES, t, type Locale } from '../../i18n';

export interface NavbarHandle {
  element: HTMLElement;
  setLoading: (isLoading: boolean) => void;
}

/**
 * Barra superior fija, con efecto de vidrio esmerilado sobre el contenido
 * que se desplaza por debajo.
 *
 * Contiene el selector de idioma. El selector no repinta la pantalla por
 * su cuenta: solo llama a `setLocale`, y quien esté suscrito a
 * `onLocaleChange` decide qué volver a dibujar. Así este componente no
 * necesita saber nada del resto de la aplicación.
 */
export function createNavbarElement(onRefresh: () => void): NavbarHandle {
  const nav = document.createElement('nav');
  nav.className = 'sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800';

  nav.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 py-3 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 shadow-lg shadow-indigo-500/20 flex items-center justify-center text-white">
          ${renderIcon('home', 'w-5 h-5')}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xl font-extrabold font-display text-white">Click<span class="text-indigo-400">TuCasa</span></span>
            <span class="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full">
              ${renderIcon('shield', 'w-3 h-3')} ${t('nav.badge')}
            </span>
          </div>
          <p class="hidden sm:block text-[11px] text-slate-500">${t('nav.tagline')}</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div
          id="selector-idioma"
          role="group"
          aria-label="${t('nav.languageAria')}"
          class="flex items-center gap-0.5 p-0.5 rounded-xl border border-slate-800 bg-slate-900"
        ></div>

        <button
          type="button"
          id="btn-refresh-catalog"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
        >
          <span id="refresh-icon" class="inline-flex">${renderIcon('refresh', 'w-4 h-4')}</span>
          <span class="hidden sm:inline">${t('nav.refresh')}</span>
        </button>
      </div>
    </div>
  `;

  // ── Selector de idioma ─────────────────────────────────────────
  const languageGroup = nav.querySelector<HTMLElement>('#selector-idioma');

  if (languageGroup) {
    const activeLocale = getLocale();

    SUPPORTED_LOCALES.forEach(({ code, label, flag }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.locale = code;
      button.textContent = flag;
      // El nombre completo del idioma va en el título y en la etiqueta
      // accesible; el botón muestra solo las dos letras para no robarle
      // ancho a la barra en pantallas pequeñas.
      button.title = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', String(code === activeLocale));
      button.className =
        code === activeLocale
          ? 'px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 text-white transition-colors cursor-pointer'
          : 'px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer';

      button.addEventListener('click', () => {
        setLocale(code satisfies Locale);
      });

      languageGroup.appendChild(button);
    });
  }

  // ── Recarga del catálogo ───────────────────────────────────────
  const refreshButton = nav.querySelector<HTMLButtonElement>('#btn-refresh-catalog');
  const refreshIcon = nav.querySelector<HTMLElement>('#refresh-icon');

  if (refreshButton) {
    refreshButton.addEventListener('click', () => onRefresh());
  }

  const setLoading = (isLoading: boolean): void => {
    if (refreshButton) {
      refreshButton.disabled = isLoading;
    }
    if (refreshIcon) {
      refreshIcon.className = isLoading ? 'inline-flex animate-spin text-indigo-400' : 'inline-flex';
    }
  };

  return { element: nav, setLoading };
}
