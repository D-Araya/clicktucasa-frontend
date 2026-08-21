import { renderIcon } from '../../utils/icon.utils';

export interface NavbarHandle {
  element: HTMLElement;
  setLoading: (isLoading: boolean) => void;
}

/**
 * Barra superior fija, con efecto de vidrio esmerilado sobre el contenido
 * que se desplaza por debajo.
 */
export function createNavbarElement(onRefresh: () => void): NavbarHandle {
  const nav = document.createElement('nav');
  nav.className =
    'sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800';

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
              ${renderIcon('shield', 'w-3 h-3')} Notariado
            </span>
          </div>
          <p class="hidden sm:block text-[11px] text-slate-500">Rifas inmobiliarias con acta pública</p>
        </div>
      </div>
      <button
        type="button"
        id="btn-refresh-catalog"
        class="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
      >
        <span id="refresh-icon" class="inline-flex">${renderIcon('refresh', 'w-4 h-4')}</span>
        <span class="hidden sm:inline">Actualizar catálogo</span>
      </button>
    </div>
  `;

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
