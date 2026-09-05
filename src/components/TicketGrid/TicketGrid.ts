import { type Raffle, type Ticket, TicketStatus, ticketStatusLabel } from '../../models';
import { APP_CONFIG } from '../../config/app.config';
import { formatTicketNumber, formatNumber, formatCurrencyCLP } from '../../utils/format.utils';
import { renderIcon } from '../../utils/icon.utils';
import { plural, t } from '../../i18n';

/**
 * Estado de navegación y selección de la grilla. Vive fuera del componente
 * para sobrevivir a los re-renderizados que ocurren tras reservar o comprar:
 * con 15.000 boletos, volver siempre a la página 1 y perder la cesta sería
 * inaceptable.
 */
export interface TicketGridState {
  page: number;
  onlyAvailable: boolean;
  selected: Set<number>;
  /**
   * Identificador de la persona que está operando la grilla, conocido en
   * cuanto envía el primer formulario. Es lo que permite distinguir "este
   * boleto está reservado" de "este boleto está reservado POR MÍ": el
   * dominio del backend deja comprar un boleto que uno mismo reservó
   * (`PurchaseTicketUseCase` acepta un RESERVED cuyo `ownerId` coincide),
   * así que la interfaz no puede prohibirlo.
   */
  currentUserId?: string;
}

export function createTicketGridState(): TicketGridState {
  return { page: 1, onlyAvailable: true, selected: new Set<number>() };
}

export interface TicketGridHandle {
  element: HTMLElement;
}

const STATUS_STYLES: Record<TicketStatus, string> = {
  [TicketStatus.AVAILABLE]:
    'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-indigo-900/60 hover:border-indigo-500/70 hover:text-white',
  [TicketStatus.RESERVED]:
    'bg-amber-500/10 border-amber-500/20 text-amber-400/70 cursor-not-allowed',
  [TicketStatus.SOLD]: 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed opacity-50',
};

/** Reservado por la propia persona: sigue siendo operable, y se ve distinto. */
const MINE_STYLE =
  'bg-amber-500/20 border-amber-400/60 text-amber-200 hover:bg-amber-500/30 hover:border-amber-300';

const SELECTED_STYLE =
  'bg-indigo-600 border-indigo-400 text-white font-bold shadow-md shadow-indigo-600/40 scale-105 z-10';

/**
 * Selector de boletos: grilla paginada con selección múltiple, elección
 * al azar, buscador de folio exacto y cesta con probabilidad calculada.
 */
export function createTicketGridElement(
  raffle: Raffle,
  state: TicketGridState,
  onSelectionChange: (selected: readonly number[]) => void,
): TicketGridHandle {
  const tickets = raffle.tickets.slice().sort((a, b) => a.number - b.number);
  const ticketByNumber = new Map<number, Ticket>(tickets.map((ticket) => [ticket.number, ticket]));

  /**
   * Un boleto es operable si está disponible o si la propia persona lo
   * reservó. Sin la segunda mitad, reservar la cesta la vaciaba y dejaba
   * el formulario de compra muerto: la UI impedía algo que el dominio sí
   * autoriza.
   */
  function isSelectable(ticket: Ticket): boolean {
    if (ticket.status === TicketStatus.AVAILABLE) {
      return true;
    }
    return (
      ticket.status === TicketStatus.RESERVED &&
      state.currentUserId !== undefined &&
      ticket.ownerId === state.currentUserId
    );
  }

  // Se descartan de la cesta los boletos que dejaron de ser operables
  // (los tomó otra persona mientras tanto). Los que uno mismo acaba de
  // reservar se conservan, para poder comprarlos a continuación.
  state.selected.forEach((number) => {
    const ticket = ticketByNumber.get(number);
    if (ticket === undefined || !isSelectable(ticket)) {
      state.selected.delete(number);
    }
  });

  const container = document.createElement('section');
  container.className =
    'bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5';

  container.innerHTML = `
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          ${renderIcon('ticket', 'w-5 h-5')}
        </div>
        <div>
          <h3 class="text-base font-bold text-white font-display">${t('grid.title')}</h3>
          <p id="emision-total" class="text-[11px] text-slate-500"></p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-[11px] text-slate-500 mr-1">${t('grid.random')}</span>
        <button type="button" data-quick-pick="1" class="quick-pick">+1</button>
        <button type="button" data-quick-pick="5" class="quick-pick">+5</button>
        <button type="button" data-quick-pick="10" class="quick-pick">+10</button>
      </div>
    </div>

    <div class="rounded-xl bg-slate-950 border border-slate-800 shadow-inner p-3 space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <label for="buscar-boleto" class="text-xs font-semibold text-slate-300">${t('grid.searchLabel')}</label>
        <input
          type="number"
          id="buscar-boleto"
          min="1"
          max="${raffle.tickets.length}"
          placeholder="${t('grid.searchPlaceholder')}"
          class="w-32 rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-100 font-mono outline-none focus:border-indigo-500 transition-colors"
        />
        <span id="rango-valido" class="text-[11px] text-slate-500 font-mono"></span>
      </div>
      <div id="resultado-busqueda"></div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-3 text-[11px] text-slate-400">
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded bg-slate-800 border border-slate-700"></span>${t('grid.legend.available')}</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded bg-indigo-600 shadow-sm shadow-indigo-500"></span>${t('grid.legend.selected')}</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40"></span>${t('grid.legend.reserved')}</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded bg-slate-950 border border-slate-800"></span>${t('grid.legend.sold')}</span>
      </div>
      <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
        <input type="checkbox" id="filtro-disponibles" class="accent-indigo-500 cursor-pointer" />
        ${t('grid.onlyAvailable')}
      </label>
    </div>

    <div id="grilla-boletos" class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 max-h-80 overflow-y-auto p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800" role="list" aria-label="${t('grid.aria')}"></div>
    <p id="sin-boletos" class="hidden text-sm text-slate-400 py-6 text-center">${t('grid.empty')}</p>

    <div class="flex items-center justify-between gap-3">
      <button type="button" id="pagina-anterior" class="pager-btn">${renderIcon('chevronLeft', 'w-3.5 h-3.5')}<span class="hidden sm:inline">${t('grid.previous')}</span></button>
      <span id="indicador-pagina" class="text-[11px] text-slate-400 font-mono text-center"></span>
      <button type="button" id="pagina-siguiente" class="pager-btn"><span class="hidden sm:inline">${t('grid.next')}</span>${renderIcon('chevronRight', 'w-3.5 h-3.5')}</button>
    </div>

    <div id="cesta" class="hidden rounded-2xl bg-indigo-950/40 border border-indigo-500/30 p-4 space-y-3"></div>
  `;

  // Estilos compartidos de los botones auxiliares (declarados una sola vez).
  container.querySelectorAll<HTMLButtonElement>('.quick-pick').forEach((button) => {
    button.className =
      'rounded-lg bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 px-2.5 py-1 text-xs font-bold ' +
      'hover:bg-indigo-900/80 hover:scale-105 active:scale-95 transition-all cursor-pointer';
  });
  container.querySelectorAll<HTMLButtonElement>('.pager-btn').forEach((button) => {
    button.className =
      'inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 ' +
      'hover:border-slate-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  });

  // ── Referencias con guardia de nulidad ─────────────────────────
  const emissionLabel = container.querySelector<HTMLElement>('#emision-total');
  const rangeLabel = container.querySelector<HTMLElement>('#rango-valido');
  const searchInput = container.querySelector<HTMLInputElement>('#buscar-boleto');
  const searchResult = container.querySelector<HTMLElement>('#resultado-busqueda');
  const availabilityFilter = container.querySelector<HTMLInputElement>('#filtro-disponibles');
  const grid = container.querySelector<HTMLElement>('#grilla-boletos');
  const emptyMessage = container.querySelector<HTMLElement>('#sin-boletos');
  const prevButton = container.querySelector<HTMLButtonElement>('#pagina-anterior');
  const nextButton = container.querySelector<HTMLButtonElement>('#pagina-siguiente');
  const pageIndicator = container.querySelector<HTMLElement>('#indicador-pagina');
  const cart = container.querySelector<HTMLElement>('#cesta');

  if (emissionLabel) {
    emissionLabel.textContent = t('grid.issuance', {
      count: formatNumber(raffle.tickets.length),
      last: formatNumber(raffle.tickets.length),
    });
  }
  if (rangeLabel) {
    rangeLabel.textContent = t('grid.validRange', { max: formatNumber(raffle.tickets.length) });
  }

  // Índice de celdas visibles: permite repintar UNA celda al seleccionarla
  // en vez de reconstruir las 200 de la página.
  const cellByNumber = new Map<number, HTMLButtonElement>();

  function cellClassName(ticket: Ticket): string {
    const base =
      'h-10 rounded-lg border text-[11px] font-mono flex items-center justify-center transition-all';
    const isSelected = state.selected.has(ticket.number);
    if (isSelected) {
      return `${base} ${SELECTED_STYLE}`;
    }
    const isMineReserved = ticket.status === TicketStatus.RESERVED && isSelectable(ticket);
    return `${base} ${isMineReserved ? MINE_STYLE : STATUS_STYLES[ticket.status]}`;
  }

  function getVisibleTickets(): Ticket[] {
    return state.onlyAvailable
      ? tickets.filter((ticket) => isSelectable(ticket) || state.selected.has(ticket.number))
      : tickets;
  }

  function toggleTicket(ticketNumber: number): void {
    const ticket = ticketByNumber.get(ticketNumber);
    if (!ticket || !isSelectable(ticket)) {
      return;
    }

    if (state.selected.has(ticketNumber)) {
      state.selected.delete(ticketNumber);
    } else {
      state.selected.add(ticketNumber);
    }

    const cell = cellByNumber.get(ticketNumber);
    if (cell) {
      cell.className = cellClassName(ticket);
    }

    renderCart();
    onSelectionChange(sortedSelection());
  }

  function sortedSelection(): number[] {
    return Array.from(state.selected).sort((a, b) => a - b);
  }

  // ── Grilla ─────────────────────────────────────────────────────
  function renderGrid(): void {
    if (!grid) return;

    const visibleTickets = getVisibleTickets();
    const pageSize = APP_CONFIG.TICKET_PAGE_SIZE;
    const totalPages = Math.max(1, Math.ceil(visibleTickets.length / pageSize));

    state.page = Math.min(Math.max(1, state.page), totalPages);

    const startIndex = (state.page - 1) * pageSize;
    const pageTickets = visibleTickets.slice(startIndex, startIndex + pageSize);

    grid.replaceChildren();
    cellByNumber.clear();
    emptyMessage?.classList.toggle('hidden', visibleTickets.length > 0);

    const fragment = document.createDocumentFragment();

    pageTickets.forEach((ticket) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = cellClassName(ticket);
      cell.dataset.ticketNumber = String(ticket.number);
      cell.dataset.ticketStatus = ticket.status;
      cell.disabled = !isSelectable(ticket);
      const mineSuffix =
        ticket.status === TicketStatus.RESERVED && isSelectable(ticket)
          ? t('grid.reservedByYouSuffix')
          : '';
      cell.title =
        t('grid.ticketTitle', {
          number: formatTicketNumber(ticket.number),
          status: ticketStatusLabel(ticket.status),
        }) + mineSuffix;
      cell.setAttribute('aria-label', cell.title);
      cell.textContent = formatTicketNumber(ticket.number);
      cellByNumber.set(ticket.number, cell);
      fragment.appendChild(cell);
    });

    grid.appendChild(fragment);

    if (pageIndicator) {
      const shownFrom = visibleTickets.length === 0 ? 0 : startIndex + 1;
      const shownTo = startIndex + pageTickets.length;
      pageIndicator.textContent = t('grid.page', {
        page: formatNumber(state.page),
        total: formatNumber(totalPages),
        from: formatNumber(shownFrom),
        to: formatNumber(shownTo),
        count: formatNumber(visibleTickets.length),
      });
    }

    if (prevButton) prevButton.disabled = state.page <= 1;
    if (nextButton) nextButton.disabled = state.page >= totalPages;
  }

  // ── Cesta ──────────────────────────────────────────────────────
  function renderCart(): void {
    if (!cart) return;

    const selection = sortedSelection();
    cart.classList.toggle('hidden', selection.length === 0);

    if (selection.length === 0) {
      cart.replaceChildren();
      return;
    }

    cart.replaceChildren();

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between gap-3';

    const heading = document.createElement('p');
    heading.className = 'text-xs font-bold text-indigo-300 uppercase tracking-wider';
    heading.textContent = plural('cart.heading.one', 'cart.heading.other', selection.length, {
      count: formatNumber(selection.length),
    });

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className =
      'text-[11px] text-rose-400 hover:text-rose-300 font-semibold transition-colors cursor-pointer';
    clearButton.textContent = t('cart.clear');
    clearButton.addEventListener('click', () => {
      const previous = sortedSelection();
      state.selected.clear();
      previous.forEach((number) => {
        const ticket = ticketByNumber.get(number);
        const cell = cellByNumber.get(number);
        if (ticket && cell) {
          cell.className = cellClassName(ticket);
        }
      });
      renderCart();
      onSelectionChange([]);
    });

    header.append(heading, clearButton);

    const chips = document.createElement('div');
    chips.className = 'flex flex-wrap gap-1.5 max-h-24 overflow-y-auto';

    selection.forEach((number) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className =
        'inline-flex items-center gap-1 rounded-lg bg-indigo-600 text-white px-2 py-1 text-[11px] font-mono ' +
        'hover:bg-indigo-500 transition-colors cursor-pointer';
      const chipLabel = document.createElement('span');
      chipLabel.textContent = formatTicketNumber(number);
      chip.append(chipLabel);
      chip.insertAdjacentHTML('beforeend', renderIcon('close', 'w-3 h-3'));
      chip.addEventListener('click', () => toggleTicket(number));
      chips.appendChild(chip);
    });

    // Resumen: probabilidad e importe.
    const summary = document.createElement('div');
    summary.className = 'grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1';

    const probability = ((selection.length / raffle.tickets.length) * 100).toFixed(4);

    summary.append(
      buildSummaryCell(t('cart.tickets'), formatNumber(selection.length), 'text-white'),
      buildSummaryCell(t('cart.probability'), `${probability}%`, 'text-emerald-400'),
      buildSummaryCell(
        t('cart.total'),
        formatCurrencyCLP(selection.length * raffle.ticketPrice),
        'text-indigo-400',
      ),
    );

    cart.append(header, chips, summary);
  }

  // ── Búsqueda de folio exacto (con debounce) ────────────────────
  function renderSearchResult(rawValue: string): void {
    if (!searchResult) return;

    searchResult.replaceChildren();
    const trimmed = rawValue.trim();

    if (trimmed.length === 0) {
      return;
    }

    if (!/^\d+$/.test(trimmed)) {
      searchResult.appendChild(buildSearchMessage(t('grid.onlyDigits'), 'error'));
      return;
    }

    const ticketNumber = parseInt(trimmed, 10);
    const ticket = ticketByNumber.get(ticketNumber);

    if (!ticket) {
      searchResult.appendChild(
        buildSearchMessage(
          t('grid.outOfRange', {
            number: formatNumber(ticketNumber),
            max: formatNumber(raffle.tickets.length),
          }),
          'error',
        ),
      );
      return;
    }

    const row = document.createElement('div');
    row.className =
      'flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900 border border-slate-800 p-2.5';

    const info = document.createElement('div');
    info.className = 'flex items-center gap-2.5';

    const badge = document.createElement('span');
    badge.className =
      'inline-flex items-center justify-center min-w-[5rem] h-9 rounded-lg bg-indigo-950/90 border border-indigo-500/40 ' +
      'font-mono text-sm text-indigo-200 shadow-inner tracking-wider';
    badge.textContent = formatTicketNumber(ticket.number);

    const statusChip = document.createElement('span');
    statusChip.className = `text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusChipClass(ticket.status)}`;
    statusChip.textContent = state.selected.has(ticket.number)
      ? t('grid.inYourCart')
      : ticket.status === TicketStatus.RESERVED && isSelectable(ticket)
        ? t('grid.reservedByYou')
        : ticketStatusLabel(ticket.status);

    info.append(badge, statusChip);

    const action = document.createElement('button');
    action.type = 'button';
    const isAvailable = isSelectable(ticket);
    action.disabled = !isAvailable;
    action.className = isAvailable
      ? 'rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer'
      : 'rounded-lg bg-slate-800 text-slate-500 px-3 py-1.5 text-xs font-semibold cursor-not-allowed';
    action.textContent = state.selected.has(ticket.number)
      ? t('grid.removeFromCart')
      : isAvailable
        ? t('grid.addToCart')
        : t('grid.unavailable');
    action.addEventListener('click', () => {
      toggleTicket(ticket.number);
      jumpToTicket(ticket.number);
      renderSearchResult(rawValue);
    });

    row.append(info, action);
    searchResult.appendChild(row);
  }

  function jumpToTicket(ticketNumber: number): void {
    const visibleTickets = getVisibleTickets();
    const position = visibleTickets.findIndex((ticket) => ticket.number === ticketNumber);
    if (position === -1) {
      return;
    }
    state.page = Math.floor(position / APP_CONFIG.TICKET_PAGE_SIZE) + 1;
    renderGrid();
  }

  // ── Elección al azar ───────────────────────────────────────────
  function quickPick(count: number): void {
    const pool = tickets.filter(
      (ticket) => ticket.status === TicketStatus.AVAILABLE && !state.selected.has(ticket.number),
    );
    if (pool.length === 0) {
      return;
    }

    const picked: number[] = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const index = Math.floor(Math.random() * pool.length);
      const [ticket] = pool.splice(index, 1);
      if (ticket) {
        state.selected.add(ticket.number);
        picked.push(ticket.number);
      }
    }

    picked.forEach((number) => {
      const ticket = ticketByNumber.get(number);
      const cell = cellByNumber.get(number);
      if (ticket && cell) {
        cell.className = cellClassName(ticket);
      }
    });

    renderCart();
    onSelectionChange(sortedSelection());

    const first = picked[0];
    if (first !== undefined) {
      jumpToTicket(first);
    }
  }

  // ── Cableado de eventos ────────────────────────────────────────
  container.querySelectorAll<HTMLButtonElement>('[data-quick-pick]').forEach((button) => {
    button.addEventListener('click', () => {
      const count = Number(button.dataset.quickPick);
      if (!Number.isNaN(count)) {
        quickPick(count);
      }
    });
  });

  if (availabilityFilter) {
    availabilityFilter.checked = state.onlyAvailable;
    availabilityFilter.addEventListener('change', () => {
      state.onlyAvailable = availabilityFilter.checked;
      state.page = 1;
      renderGrid();
    });
  }

  if (searchInput) {
    let debounceTimer: number | undefined;
    searchInput.addEventListener('input', () => {
      window.clearTimeout(debounceTimer);
      const value = searchInput.value;
      debounceTimer = window.setTimeout(() => renderSearchResult(value), 150);
    });
  }

  // Delegación de eventos: un único listener para las 200 celdas.
  if (grid) {
    grid.addEventListener('click', (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const cell = target.closest<HTMLButtonElement>('[data-ticket-number]');
      if (cell === null || cell.disabled) return;

      const ticketNumber = Number(cell.dataset.ticketNumber);
      if (!Number.isNaN(ticketNumber)) {
        toggleTicket(ticketNumber);
      }
    });
  }

  prevButton?.addEventListener('click', () => {
    state.page -= 1;
    renderGrid();
  });

  nextButton?.addEventListener('click', () => {
    state.page += 1;
    renderGrid();
  });

  renderGrid();
  renderCart();

  return { element: container };
}

// ── Helpers de presentación ───────────────────────────────────────

function buildSummaryCell(label: string, value: string, tone: string): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2';

  const labelElement = document.createElement('p');
  labelElement.className = 'text-[10px] uppercase tracking-wider text-slate-500 font-bold';
  labelElement.textContent = label;

  const valueElement = document.createElement('p');
  valueElement.className = `text-base font-black font-display font-mono ${tone}`;
  valueElement.textContent = value;

  cell.append(labelElement, valueElement);
  return cell;
}

function statusChipClass(status: TicketStatus): string {
  switch (status) {
    case TicketStatus.AVAILABLE:
      return 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400';
    case TicketStatus.RESERVED:
      return 'bg-amber-500/10 border border-amber-500/30 text-amber-400';
    case TicketStatus.SOLD:
      return 'bg-rose-500/10 border border-rose-500/30 text-rose-400';
  }
}

function buildSearchMessage(message: string, kind: 'error' | 'info'): HTMLElement {
  const element = document.createElement('p');
  element.className =
    kind === 'error'
      ? 'flex items-center gap-1.5 text-[11px] text-rose-400'
      : 'flex items-center gap-1.5 text-[11px] text-slate-400';
  element.innerHTML = renderIcon(kind === 'error' ? 'alert' : 'info', 'w-3.5 h-3.5 shrink-0');
  const text = document.createElement('span');
  text.textContent = message;
  element.appendChild(text);
  return element;
}
