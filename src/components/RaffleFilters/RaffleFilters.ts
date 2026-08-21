import {
  type Raffle,
  RaffleStatus,
  RaffleSortOrder,
  RAFFLE_SORT_LABELS,
  summarizeRaffle,
} from '../../models';
import { formatNumber } from '../../utils/format.utils';
import { renderIcon } from '../../utils/icon.utils';

/** Filtro de estado: los tres del dominio, más el pseudo-valor "todas". */
export const ALL_STATUSES = 'ALL' as const;
export type StatusFilter = RaffleStatus | typeof ALL_STATUSES;

/** Ciudad "todas": pseudo-valor de interfaz, no un dato del dominio. */
export const ALL_CITIES = 'Todas' as const;

export interface CatalogFilters {
  search: string;
  status: StatusFilter;
  city: string;
  sort: RaffleSortOrder;
}

export function createDefaultFilters(): CatalogFilters {
  return {
    search: '',
    status: ALL_STATUSES,
    city: ALL_CITIES,
    sort: RaffleSortOrder.POPULAR,
  };
}

const STATUS_TABS: ReadonlyArray<{ value: StatusFilter; label: string; activeClass: string }> = [
  { value: ALL_STATUSES, label: 'Todas', activeClass: 'bg-indigo-600 text-white' },
  { value: RaffleStatus.ACTIVE, label: 'Activas', activeClass: 'bg-emerald-600 text-white' },
  { value: RaffleStatus.DRAWN, label: 'Sorteadas', activeClass: 'bg-amber-600 text-white' },
  { value: RaffleStatus.CANCELLED, label: 'Canceladas', activeClass: 'bg-rose-600 text-white' },
];

/**
 * Aplica búsqueda, estado, ciudad y orden sobre el catálogo.
 * Es una función pura: la vista decide cuándo llamarla y qué hacer con
 * el resultado.
 */
export function applyFilters(raffles: readonly Raffle[], filters: CatalogFilters): Raffle[] {
  const needle = filters.search.trim().toLowerCase();

  const filtered = raffles.filter((raffle) => {
    if (filters.status !== ALL_STATUSES && raffle.status !== filters.status) {
      return false;
    }
    if (filters.city !== ALL_CITIES && raffle.city !== filters.city) {
      return false;
    }
    if (needle.length === 0) {
      return true;
    }
    const haystack = [
      raffle.title,
      raffle.tagline,
      raffle.city,
      raffle.region,
      raffle.houseAddress.value,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });

  return sortRaffles(filtered, filters.sort);
}

function sortRaffles(raffles: Raffle[], order: RaffleSortOrder): Raffle[] {
  const sorted = raffles.slice();

  switch (order) {
    case RaffleSortOrder.POPULAR:
      return sorted.sort((a, b) => {
        const ratioA = summarizeRaffle(a).soldPercentage;
        const ratioB = summarizeRaffle(b).soldPercentage;
        if (ratioB !== ratioA) return ratioB - ratioA;
        return b.houseValue.amount - a.houseValue.amount;
      });
    case RaffleSortOrder.PRICE_ASC:
      return sorted.sort((a, b) => a.ticketPrice - b.ticketPrice);
    case RaffleSortOrder.PRICE_DESC:
      return sorted.sort((a, b) => b.ticketPrice - a.ticketPrice);
    case RaffleSortOrder.VALUE_DESC:
      return sorted.sort((a, b) => b.houseValue.amount - a.houseValue.amount);
    case RaffleSortOrder.ENDING_SOON:
      return sorted.sort((a, b) => {
        // Las rifas sin fecha de sorteo van siempre al final.
        const timeA = a.endDate ? a.endDate.getTime() : Number.MAX_SAFE_INTEGER;
        const timeB = b.endDate ? b.endDate.getTime() : Number.MAX_SAFE_INTEGER;
        return timeA - timeB;
      });
  }
}

/**
 * Barra de filtros del catálogo. Notifica cada cambio con el objeto de
 * filtros completo; la vista es quien decide re-renderizar.
 */
export function createRaffleFiltersElement(
  raffles: readonly Raffle[],
  filters: CatalogFilters,
  resultCount: number,
  onChange: (filters: CatalogFilters) => void,
): HTMLElement {
  const panel = document.createElement('section');
  panel.className =
    'bg-slate-950/70 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4';

  const cities = [ALL_CITIES, ...new Set(raffles.map((raffle) => raffle.city))].sort((a, b) =>
    a === ALL_CITIES ? -1 : b === ALL_CITIES ? 1 : a.localeCompare(b, 'es'),
  );

  panel.innerHTML = `
    <div class="flex flex-col lg:flex-row lg:items-center gap-3">
      <div id="status-tabs" class="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto"></div>

      <div class="relative flex-1 min-w-[12rem]">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">${renderIcon('search', 'w-4 h-4')}</span>
        <input
          type="search"
          id="filtro-busqueda"
          value="${filters.search.replace(/"/g, '&quot;')}"
          placeholder="Buscar por casa, ciudad o dirección..."
          class="w-full rounded-xl bg-slate-900 border border-slate-800 pl-9 pr-9 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="button"
          id="limpiar-busqueda"
          class="${filters.search ? '' : 'hidden '}absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
          aria-label="Limpiar búsqueda"
        >${renderIcon('close', 'w-4 h-4')}</button>
      </div>

      <select
        id="filtro-ciudad"
        class="rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors cursor-pointer ${
          filters.city !== ALL_CITIES
            ? 'border-indigo-500/80 text-indigo-300 font-semibold bg-indigo-950/20'
            : 'border-slate-800 bg-slate-900 text-slate-200'
        }"
      ></select>

      <select
        id="filtro-orden"
        class="rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors cursor-pointer ${
          filters.sort !== RaffleSortOrder.POPULAR
            ? 'border-indigo-500/80 text-indigo-300 font-semibold bg-indigo-950/20'
            : 'border-slate-800 bg-slate-900 text-slate-200'
        }"
      ></select>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs text-slate-400">
      <span>Mostrando <strong class="font-mono text-slate-200">${formatNumber(resultCount)}</strong> ${resultCount === 1 ? 'propiedad' : 'propiedades'}</span>
      <div id="filtros-activos" class="flex flex-wrap items-center gap-2"></div>
    </div>
  `;

  // ── Tabs de estado ─────────────────────────────────────────────
  const tabsContainer = panel.querySelector<HTMLElement>('#status-tabs');
  if (tabsContainer) {
    STATUS_TABS.forEach((tab) => {
      const button = document.createElement('button');
      button.type = 'button';
      const isActive = filters.status === tab.value;
      button.className = `px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
        isActive ? tab.activeClass : 'text-slate-400 hover:bg-slate-800/60'
      }`;
      button.textContent = tab.label;
      button.addEventListener('click', () => {
        onChange({ ...filters, status: tab.value });
      });
      tabsContainer.appendChild(button);
    });
  }

  // ── Selects ────────────────────────────────────────────────────
  const citySelect = panel.querySelector<HTMLSelectElement>('#filtro-ciudad');
  if (citySelect) {
    cities.forEach((city) => {
      const option = document.createElement('option');
      option.value = city;
      option.textContent = city === ALL_CITIES ? 'Todas las ciudades' : city;
      option.selected = city === filters.city;
      citySelect.appendChild(option);
    });
    citySelect.addEventListener('change', () => {
      onChange({ ...filters, city: citySelect.value });
    });
  }

  const sortSelect = panel.querySelector<HTMLSelectElement>('#filtro-orden');
  if (sortSelect) {
    Object.values(RaffleSortOrder).forEach((order) => {
      const option = document.createElement('option');
      option.value = order;
      option.textContent = RAFFLE_SORT_LABELS[order];
      option.selected = order === filters.sort;
      sortSelect.appendChild(option);
    });
    sortSelect.addEventListener('change', () => {
      const value = sortSelect.value;
      const allowed: string[] = Object.values(RaffleSortOrder);
      if (allowed.includes(value)) {
        onChange({ ...filters, sort: value as RaffleSortOrder });
      }
    });
  }

  // ── Búsqueda (con debounce para no re-renderizar en cada tecla) ─
  const searchInput = panel.querySelector<HTMLInputElement>('#filtro-busqueda');
  const clearSearchButton = panel.querySelector<HTMLButtonElement>('#limpiar-busqueda');

  if (searchInput) {
    let debounceTimer: number | undefined;
    searchInput.addEventListener('input', () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        onChange({ ...filters, search: searchInput.value });
      }, 220);
    });
  }

  if (clearSearchButton) {
    clearSearchButton.addEventListener('click', () => {
      onChange({ ...filters, search: '' });
    });
  }

  // ── Tags de filtros activos ────────────────────────────────────
  const activeContainer = panel.querySelector<HTMLElement>('#filtros-activos');
  if (activeContainer) {
    const activeTags: Array<{ label: string; reset: Partial<CatalogFilters> }> = [];

    if (filters.city !== ALL_CITIES) {
      activeTags.push({ label: filters.city, reset: { city: ALL_CITIES } });
    }
    if (filters.search.trim().length > 0) {
      activeTags.push({ label: `"${filters.search.trim()}"`, reset: { search: '' } });
    }
    if (filters.status !== ALL_STATUSES) {
      const tab = STATUS_TABS.find((item) => item.value === filters.status);
      activeTags.push({ label: tab?.label ?? 'Estado', reset: { status: ALL_STATUSES } });
    }
    if (filters.sort !== RaffleSortOrder.POPULAR) {
      activeTags.push({
        label: RAFFLE_SORT_LABELS[filters.sort],
        reset: { sort: RaffleSortOrder.POPULAR },
      });
    }

    activeTags.forEach((tag) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className =
        'inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-2.5 py-1 text-[11px] font-semibold hover:bg-indigo-500/20 transition-colors cursor-pointer';
      chip.innerHTML = `<span></span>${renderIcon('close', 'w-3 h-3')}`;
      const labelSpan = chip.querySelector('span');
      if (labelSpan) {
        labelSpan.textContent = tag.label;
      }
      chip.addEventListener('click', () => onChange({ ...filters, ...tag.reset }));
      activeContainer.appendChild(chip);
    });

    if (activeTags.length > 0) {
      const resetAll = document.createElement('button');
      resetAll.type = 'button';
      resetAll.className =
        'inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer';
      resetAll.innerHTML = `${renderIcon('reset', 'w-3 h-3')}<span>Restablecer filtros</span>`;
      resetAll.addEventListener('click', () => onChange(createDefaultFilters()));
      activeContainer.appendChild(resetAll);
    }
  }

  return panel;
}
