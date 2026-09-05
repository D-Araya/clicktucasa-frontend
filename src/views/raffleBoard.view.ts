import { type Raffle, type RaffleCatalogItem, RaffleStatus, summarizeRaffle } from '../models';
import type { DrawWinnerResult, BatchTicketResult } from '../models/requests.model';
import { createNavbarElement, type NavbarHandle } from '../components/Navbar';
import { createHeroBannerElement } from '../components/HeroBanner';
import {
  createRaffleFiltersElement,
  applyFilters,
  createDefaultFilters,
  ALL_CITIES,
  type CatalogFilters,
} from '../components/RaffleFilters';
import { createRaffleCardElement } from '../components/RaffleCard';
import {
  createTicketGridElement,
  createTicketGridState,
  type TicketGridState,
} from '../components/TicketGrid';
import { createReservationFormElement } from '../components/ReservationForm';
import { createPurchaseFormElement } from '../components/PurchaseForm';
import { createDrawWinnerPanelElement } from '../components/DrawWinnerPanel';
import {
  createRaffleListSkeleton,
  createTicketGridSkeleton,
  createInlineSpinner,
} from '../components/LoadingSkeleton';
import {
  createEmptyStateElement,
  createErrorStateElement,
  createSectionHeader,
} from '../components/StateViews';
import {
  formatCurrencyCLP,
  formatNumber,
  formatUF,
  formatCountdown,
  formatDate,
} from '../utils/format.utils';
import { renderIcon } from '../utils/icon.utils';
import { t } from '../i18n';

export interface ListCallbacks {
  onSelectRaffle: (raffleId: string) => void;
  onFiltersChange: (filters: CatalogFilters) => void;
}

export interface DetailCallbacks {
  onBack: () => void;
  onReservationResult: (result: BatchTicketResult, userId: string) => void;
  onPurchaseResult: (result: BatchTicketResult, userId: string) => void;
  onDrawSuccess: (result: DrawWinnerResult) => void;
}

/** Aviso persistente que corona el detalle tras una operación exitosa. */
export interface DetailNotice {
  readonly message: string;
  readonly tone: 'success' | 'warning';
}

/**
 * `RaffleBoardView` — capa de orquestación de la UI.
 *
 * Es la ÚNICA capa que sabe qué contenedor del DOM debe mostrar qué estado
 * (carga / éxito / vacío / error) en cada uno de los dos modos de la
 * aplicación: catálogo y detalle. Ningún componente conoce al resto de la
 * app, y el servicio no toca el DOM.
 */
export class RaffleBoardView {
  private readonly root: HTMLElement;
  private readonly onRefresh: () => void;
  private navbar: NavbarHandle;
  private readonly content: HTMLElement;

  /**
   * Estado de paginación y cesta de la grilla de boletos. Vive en la vista
   * para sobrevivir a los re-renderizados que ocurren tras reservar o
   * comprar: con 15.000 boletos, perder la página y la selección en cada
   * operación sería inaceptable.
   */
  private ticketGridState: TicketGridState = createTicketGridState();
  private currentRaffleId: string | null = null;

  constructor(onRefresh: () => void) {
    // Guardia de tipo: si el contenedor raíz no existe, fallamos temprano
    // y de forma explícita.
    const appContainer = document.getElementById('app');
    if (appContainer === null) {
      throw new Error(t('error.appRoot'));
    }

    this.onRefresh = onRefresh;
    this.root = appContainer;
    this.root.replaceChildren();

    this.navbar = createNavbarElement(onRefresh);

    this.content = document.createElement('main');
    this.content.id = 'contenido';

    this.root.append(this.navbar.element, this.content);
  }

  /**
   * Reconstruye la barra superior con el idioma activo.
   *
   * La barra se arma una sola vez con `innerHTML`, así que traducirla
   * significa reemplazarla entera. Es barato — un puñado de nodos — y
   * evita tener que mantener referencias a cada texto suelto.
   */
  refreshChrome(): void {
    const previous = this.navbar.element;
    this.navbar = createNavbarElement(this.onRefresh);
    previous.replaceWith(this.navbar.element);
  }

  // ── Catálogo ─────────────────────────────────────────────────────

  showListLoading(): void {
    this.navbar.setLoading(true);

    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6';

    wrapper.appendChild(createInlineSpinner(t('state.loading.catalog')));

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
    grid.appendChild(createRaffleListSkeleton());
    wrapper.appendChild(grid);

    this.content.replaceChildren(wrapper);
  }

  showListError(message: string, onRetry: () => void): void {
    this.navbar.setLoading(false);

    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16';
    wrapper.appendChild(createErrorStateElement(message, onRetry));

    this.content.replaceChildren(wrapper);
  }

  renderRaffleList(
    raffles: readonly RaffleCatalogItem[],
    filters: CatalogFilters,
    callbacks: ListCallbacks,
  ): void {
    this.navbar.setLoading(false);
    this.currentRaffleId = null;

    const visible = applyFilters(raffles, filters);

    const fragment = document.createDocumentFragment();

    fragment.appendChild(
      createHeroBannerElement(raffles, filters.city, (city) => {
        callbacks.onFiltersChange({ ...filters, city });
      }),
    );

    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8';

    wrapper.appendChild(
      createRaffleFiltersElement(raffles, filters, visible.length, callbacks.onFiltersChange),
    );

    if (visible.length === 0) {
      wrapper.appendChild(
        createEmptyStateElement(
          t('state.empty.filters'),
          t('filters.reset'),
          () => callbacks.onFiltersChange(createDefaultFilters()),
        ),
      );
    } else {
      const sections: ReadonlyArray<{
        status: RaffleStatus;
        icon: string;
        title: string;
        subtitle: string;
        tone: 'emerald' | 'amber' | 'slate';
      }> = [
        {
          status: RaffleStatus.ACTIVE,
          icon: 'bolt',
          title: t('section.active.title'),
          subtitle: t('section.active.subtitle'),
          tone: 'emerald',
        },
        {
          status: RaffleStatus.DRAWN,
          icon: 'trophy',
          title: t('section.drawn.title'),
          subtitle: t('section.drawn.subtitle'),
          tone: 'amber',
        },
        {
          status: RaffleStatus.CANCELLED,
          icon: 'close',
          title: t('section.cancelled.title'),
          subtitle: t('section.cancelled.subtitle'),
          tone: 'slate',
        },
      ];

      sections.forEach((section) => {
        const sectionRaffles = visible.filter((raffle) => raffle.status === section.status);
        if (sectionRaffles.length === 0) {
          return;
        }

        const block = document.createElement('section');
        block.appendChild(
          createSectionHeader(
            section.icon,
            section.title,
            section.subtitle,
            sectionRaffles.length,
            section.tone,
          ),
        );

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger';

        const cards = document.createDocumentFragment();
        sectionRaffles.forEach((raffle) => cards.appendChild(createRaffleCardElement(raffle)));
        grid.appendChild(cards);

        // Delegación de eventos: un único listener para todas las tarjetas.
        grid.addEventListener('click', (event: Event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;

          const button = target.closest<HTMLButtonElement>('[data-action="view-detail"]');
          if (button === null) return;

          const raffleId = button.dataset.raffleId;
          if (raffleId) {
            callbacks.onSelectRaffle(raffleId);
          }
        });

        block.appendChild(grid);
        wrapper.appendChild(block);
      });
    }

    fragment.appendChild(wrapper);
    this.content.replaceChildren(fragment);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Detalle ──────────────────────────────────────────────────────

  showDetailLoading(): void {
    this.navbar.setLoading(true);

    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10';
    wrapper.appendChild(createTicketGridSkeleton());

    this.content.replaceChildren(wrapper);
  }

  showDetailError(message: string, onRetry: () => void, onBack: () => void): void {
    this.navbar.setLoading(false);

    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-5';
    wrapper.append(this.createBackButton(onBack), createErrorStateElement(message, onRetry));

    this.content.replaceChildren(wrapper);
  }

  renderRaffleDetail(
    raffle: Raffle,
    callbacks: DetailCallbacks,
    notice?: DetailNotice,
    currentUserId?: string,
  ): void {
    this.navbar.setLoading(false);

    // Al cambiar de rifa, la paginación y la cesta vuelven a empezar.
    if (this.currentRaffleId !== raffle.id) {
      this.currentRaffleId = raffle.id;
      this.ticketGridState = createTicketGridState();
    }

    // En cuanto la persona se identifica al enviar un formulario, la grilla
    // puede distinguir sus propias reservas de las ajenas.
    if (currentUserId !== undefined) {
      this.ticketGridState.currentUserId = currentUserId;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5';

    wrapper.appendChild(this.createBackButton(callbacks.onBack));

    if (notice) {
      wrapper.appendChild(this.buildNotice(notice));
    }

    wrapper.appendChild(this.buildPropertySheet(raffle));
    // La garantía notarial es un bloque de presentación: solo se pinta si el
    // backend llega a exponer esos datos. Un bloque legal con campos vacíos
    // sería peor que no mostrarlo.
    const notaryBlock = this.buildNotaryBlock(raffle);
    if (notaryBlock !== null) {
      wrapper.appendChild(notaryBlock);
    }

    if (raffle.status === RaffleStatus.ACTIVE) {
      const reservationHandle = createReservationFormElement(raffle, callbacks.onReservationResult);
      const purchaseHandle = createPurchaseFormElement(raffle, callbacks.onPurchaseResult);

      const gridHandle = createTicketGridElement(
        raffle,
        this.ticketGridState,
        (selected: readonly number[]) => {
          reservationHandle.setSelection(selected);
          purchaseHandle.setSelection(selected);
        },
      );

      // Sincroniza el estado inicial (la cesta puede venir de un render previo).
      const initialSelection = Array.from(this.ticketGridState.selected).sort((a, b) => a - b);
      reservationHandle.setSelection(initialSelection);
      purchaseHandle.setSelection(initialSelection);

      const formsGrid = document.createElement('div');
      formsGrid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-4';
      formsGrid.append(reservationHandle.element, purchaseHandle.element);

      wrapper.append(gridHandle.element, formsGrid);
    }

    const drawHandle = createDrawWinnerPanelElement(raffle, callbacks.onDrawSuccess);
    wrapper.appendChild(drawHandle.element);

    this.content.replaceChildren(wrapper);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Piezas privadas del detalle ──────────────────────────────────

  private buildNotice(notice: DetailNotice): HTMLElement {
    const banner = document.createElement('div');
    banner.className =
      notice.tone === 'success'
        ? 'flex items-start gap-2.5 rounded-xl border border-emerald-700 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300 font-medium animate-slide-up'
        : 'flex items-start gap-2.5 rounded-xl border border-amber-700 bg-amber-950/40 px-4 py-3 text-sm text-amber-300 font-medium animate-slide-up';
    banner.setAttribute('role', 'status');
    banner.innerHTML = renderIcon(
      notice.tone === 'success' ? 'checkCircle' : 'alert',
      'w-4 h-4 shrink-0 mt-0.5',
    );

    const message = document.createElement('span');
    message.textContent = notice.message;
    banner.appendChild(message);

    return banner;
  }

  private buildPropertySheet(raffle: Raffle): HTMLElement {
    const summary = summarizeRaffle(raffle);

    const card = document.createElement('article');
    card.className = 'rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl';

    // Imagen de portada
    const media = document.createElement('div');
    media.className = 'relative aspect-[21/9] bg-slate-950 overflow-hidden';

    // La fotografía no forma parte del contrato del backend: cuando falta,
    // el degradado hace de portada.
    if (raffle.imageUrl !== undefined) {
      const image = document.createElement('img');
      image.src = raffle.imageUrl;
      image.alt = t('card.photoAlt', { title: raffle.title });
      image.referrerPolicy = 'no-referrer';
      image.className = 'w-full h-full object-cover';
      image.addEventListener('error', () => {
        image.remove();
        media.classList.add('bg-gradient-to-br', 'from-indigo-950', 'via-slate-900', 'to-emerald-950');
      });
      media.appendChild(image);
    } else {
      media.classList.add('bg-gradient-to-br', 'from-indigo-950', 'via-slate-900', 'to-emerald-950');
    }

    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent';
    media.appendChild(overlay);

    const overlayContent = document.createElement('div');
    overlayContent.className = 'absolute bottom-4 left-5 right-5';

    const location = document.createElement('p');
    location.className = 'flex items-center gap-1.5 text-xs text-indigo-300 font-semibold';
    location.innerHTML = renderIcon('mapPin', 'w-3.5 h-3.5');
    const locationText = document.createElement('span');
    const place = [raffle.city, raffle.region].filter((part): part is string => part !== undefined);
    locationText.textContent = place.length > 0 ? place.join(', ') : raffle.houseAddress.value;
    location.appendChild(locationText);

    const title = document.createElement('h1');
    title.className = 'text-2xl sm:text-3xl font-black text-white font-display leading-tight';
    title.textContent = raffle.title;

    overlayContent.append(location, title);
    media.appendChild(overlayContent);
    card.appendChild(media);

    // Cuerpo
    const body = document.createElement('div');
    body.className = 'p-5 space-y-5';

    const address = document.createElement('p');
    address.className = 'text-xs text-slate-500';
    address.textContent = raffle.houseAddress.value;

    // Bloque de precios
    const priceBox = document.createElement('div');
    priceBox.className =
      'grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl bg-gradient-to-br from-slate-950 to-indigo-950/30 border border-slate-800 p-4';

    priceBox.append(
      this.buildStat(t('card.appraisedValue'), formatCurrencyCLP(raffle.houseValue.amount), 'text-white'),
      this.buildStat(t('detail.ticketPrice'), formatCurrencyCLP(raffle.ticketPrice), 'text-indigo-400'),
      this.buildStat(
        t('detail.minimumToDraw'),
        formatNumber(raffle.minTicketsToDraw),
        summary.canBeDrawn ? 'text-emerald-400' : 'text-amber-400',
      ),
    );

    if (raffle.houseValue.ufEquivalent !== undefined) {
      const ufNote = document.createElement('p');
      ufNote.className = 'text-[11px] text-indigo-300 font-mono sm:col-span-3';
      ufNote.textContent = t('detail.ufNote', { value: formatUF(raffle.houseValue.ufEquivalent) });
      priceBox.appendChild(ufNote);
    }

    // Ficha técnica: bloque de presentación. El contrato actual no la trae,
    // así que la grilla queda vacía y no se agrega al cuerpo (ver más abajo).
    const specs = raffle.specs;
    const specsGrid = document.createElement('div');
    specsGrid.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3';

    const specEntries: ReadonlyArray<{ icon: string; label: string; value: string }> =
      specs === undefined
        ? []
        : [
            { icon: 'bed', label: t('detail.specs.bedrooms'), value: String(specs.bedrooms) },
            { icon: 'bath', label: t('detail.specs.bathrooms'), value: String(specs.bathrooms) },
            { icon: 'area', label: t('detail.specs.area'), value: t('card.specs.area', { value: formatNumber(specs.areaSqM) }) },
            { icon: 'building', label: t('detail.specs.built'), value: String(specs.yearBuilt) },
            { icon: 'home', label: t('detail.specs.garage'), value: specs.hasGarage ? t('detail.yes') : t('detail.no') },
            { icon: 'bolt', label: t('detail.specs.energy'), value: specs.energyRating },
          ];

    specEntries.forEach((entry) => {
      const cell = document.createElement('div');
      cell.className = 'p-3 rounded-xl bg-slate-950 border border-slate-800 text-center';
      cell.innerHTML = `<div class="flex justify-center text-indigo-400 mb-1">${renderIcon(entry.icon, 'w-4 h-4')}</div>`;

      const label = document.createElement('p');
      label.className = 'text-[10px] uppercase tracking-wider text-slate-500 font-bold';
      label.textContent = entry.label;

      const value = document.createElement('p');
      value.className = 'text-sm font-bold text-slate-100 font-mono';
      value.textContent = entry.value;

      cell.append(value, label);
      specsGrid.appendChild(cell);
    });

    // Contadores de boletos
    const statsGrid = document.createElement('div');
    statsGrid.className = 'grid grid-cols-2 sm:grid-cols-4 gap-3';

    statsGrid.append(
      this.buildCounter(t('detail.counter.issued'), formatNumber(summary.totalCount), 'text-slate-200'),
      this.buildCounter(t('detail.counter.sold'), formatNumber(summary.soldCount), 'text-rose-300'),
      this.buildCounter(t('detail.counter.reserved'), formatNumber(summary.reservedCount), 'text-amber-300'),
      this.buildCounter(t('detail.counter.available'), formatNumber(summary.availableCount), 'text-emerald-300'),
    );

    const countdown = document.createElement('p');
    countdown.className = 'flex items-center gap-1.5 text-xs text-slate-500';
    countdown.innerHTML = renderIcon('clock', 'w-3.5 h-3.5');
    const countdownText = document.createElement('span');
    countdownText.textContent =
      raffle.endDate !== undefined
        ? `${formatCountdown(raffle.endDate)} · ${formatDate(raffle.endDate)}`
        : t('detail.drawDatePending');
    countdown.appendChild(countdownText);

    if (raffle.tagline !== undefined) {
      const tagline = document.createElement('p');
      tagline.className = 'text-sm text-slate-300 leading-relaxed';
      tagline.textContent = raffle.tagline;
      body.appendChild(tagline);
    }

    body.append(address, priceBox);
    if (specEntries.length > 0) {
      body.appendChild(specsGrid);
    }
    body.append(statsGrid, countdown);
    card.appendChild(body);

    return card;
  }

  private buildNotaryBlock(raffle: Raffle): HTMLElement | null {
    const notary = raffle.notary;
    const features = raffle.features ?? [];
    if (notary === undefined && features.length === 0) {
      return null;
    }

    const block = document.createElement('section');
    block.className =
      'rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 border border-emerald-500/30 p-5 space-y-4';

    const header = document.createElement('div');
    header.className = 'flex items-center gap-2';
    header.innerHTML = renderIcon('shield', 'w-4 h-4 text-emerald-400');

    const title = document.createElement('h2');
    title.className = 'text-base font-bold text-white font-display';
    title.textContent = t('detail.notary.title');
    header.appendChild(title);

    if (notary?.isVerified === true) {
      const verified = document.createElement('span');
      verified.className =
        'ml-auto inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full';
      verified.innerHTML = renderIcon('check', 'w-3 h-3');
      verified.appendChild(document.createTextNode(t('detail.notary.verified')));
      header.appendChild(verified);
    }

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 sm:grid-cols-3 gap-3';

    const entries: ReadonlyArray<{ label: string; value: string }> =
      notary === undefined
        ? []
        : [
            { label: t('detail.notary.office'), value: `${notary.notaryOffice} · ${notary.protocolNumber}` },
            { label: t('detail.notary.cbr'), value: notary.cbrRegistration },
            { label: t('detail.notary.sii'), value: notary.siiFiscalRole },
          ];

    entries.forEach((entry) => {
      const cell = document.createElement('div');
      cell.className = 'p-3 rounded-xl bg-slate-950 border border-slate-800';

      const label = document.createElement('p');
      label.className = 'text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1';
      label.textContent = entry.label;

      const value = document.createElement('p');
      value.className = 'text-xs text-slate-200 font-mono break-words';
      value.textContent = entry.value;

      cell.append(label, value);
      grid.appendChild(cell);
    });

    block.append(header, grid);

    if (features.length > 0) {
      const list = document.createElement('ul');
      list.className = 'grid grid-cols-1 sm:grid-cols-2 gap-2';

      features.forEach((feature) => {
        const item = document.createElement('li');
        item.className = 'flex items-start gap-2 text-xs text-slate-300';
        item.innerHTML = renderIcon('checkCircle', 'w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5');
        const text = document.createElement('span');
        text.textContent = feature;
        item.appendChild(text);
        list.appendChild(item);
      });

      block.appendChild(list);
    }

    return block;
  }

  private buildStat(label: string, value: string, tone: string): HTMLElement {
    const cell = document.createElement('div');

    const labelElement = document.createElement('p');
    labelElement.className = 'text-[10px] uppercase tracking-wider text-slate-500 font-bold';
    labelElement.textContent = label;

    const valueElement = document.createElement('p');
    valueElement.className = `text-xl font-black font-display font-mono ${tone}`;
    valueElement.textContent = value;

    cell.append(labelElement, valueElement);
    return cell;
  }

  private buildCounter(label: string, value: string, tone: string): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'rounded-xl bg-slate-950 border border-slate-800 py-2.5 text-center';

    const valueElement = document.createElement('p');
    valueElement.className = `text-lg font-black font-mono ${tone}`;
    valueElement.textContent = value;

    const labelElement = document.createElement('p');
    labelElement.className = 'text-[10px] uppercase tracking-wider text-slate-500 font-bold';
    labelElement.textContent = label;

    cell.append(valueElement, labelElement);
    return cell;
  }

  private createBackButton(onBack: () => void): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className =
      'inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer';
    button.innerHTML = renderIcon('chevronLeft', 'w-4 h-4');
    button.appendChild(document.createTextNode(t('detail.back')));
    button.addEventListener('click', () => onBack());
    return button;
  }

}

export { ALL_CITIES, createDefaultFilters };
export type { CatalogFilters };
