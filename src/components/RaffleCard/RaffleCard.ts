import { type RaffleCatalogItem, RaffleStatus, summarizeRaffle } from '../../models';
import {
  formatCurrencyCLP,
  formatNumber,
  formatUF,
  formatCountdown,
  formatTicketNumber,
} from '../../utils/format.utils';
import type { HouseSpecs } from '../../models';
import { renderIcon } from '../../utils/icon.utils';
import { t } from '../../i18n';

/**
 * Tarjeta de rifa del catálogo.
 *
 * Devuelve un `HTMLElement` real (nunca una cadena hacia afuera). El
 * andamiaje estático se arma con `innerHTML`, pero **todo dato** —título,
 * ciudad, dirección, cifras— se asigna con `textContent`, de modo que no
 * exista ninguna vía de inyección desde el contenido del catálogo.
 */
export function createRaffleCardElement(raffle: RaffleCatalogItem): HTMLElement {
  const summary = summarizeRaffle(raffle);
  const progressPct = Math.min(100, Math.round((summary.soldCount / raffle.minTicketsToDraw) * 100));

  const card = document.createElement('article');
  card.className =
    'group flex flex-col rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden ' +
    'shadow-xl hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-500/50 transition-all duration-300';
  card.dataset.raffleId = raffle.id;

  card.appendChild(buildMediaSection(raffle, summary.isEndingSoon, summary.soldPercentage));
  card.appendChild(buildContentSection(raffle, summary, progressPct));

  return card;
}

// ── Zona de imagen ──────────────────────────────────────────────

function buildMediaSection(
  raffle: RaffleCatalogItem,
  isEndingSoon: boolean,
  soldPercentage: number,
): HTMLElement {
  const media = document.createElement('div');
  media.className = 'relative aspect-[16/10] overflow-hidden bg-slate-950';

  // La fotografía es un dato de presentación que el contrato actual del
  // backend no expone. Cuando falta, el degradado del contenedor hace de
  // portada en vez de dejar un icono roto o un hueco.
  if (raffle.imageUrl !== undefined) {
    const image = document.createElement('img');
    image.src = raffle.imageUrl;
    image.alt = t('card.photoAlt', { title: raffle.title });
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.className =
      'w-full h-full object-cover group-hover:scale-105 transition-transform duration-500';
    image.addEventListener('error', () => {
      image.remove();
      media.classList.add('bg-gradient-to-br', 'from-indigo-950', 'via-slate-900', 'to-emerald-950');
    });
    media.appendChild(image);
  } else {
    media.classList.add('bg-gradient-to-br', 'from-indigo-950', 'via-slate-900', 'to-emerald-950');
  }

  const vignette = document.createElement('div');
  vignette.className = 'absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/40';
  media.appendChild(vignette);

  // Barra superior: estado + precio del boleto
  const topBar = document.createElement('div');
  topBar.className = 'absolute top-3 left-3 right-3 flex items-start justify-between gap-2';

  topBar.appendChild(buildStatusPill(raffle.status));

  const pricePill = document.createElement('span');
  pricePill.className =
    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md ' +
    'border border-slate-700/80 text-xs font-extrabold font-mono text-white';
  pricePill.innerHTML = renderIcon('ticket', 'w-3.5 h-3.5 text-indigo-400');
  const priceText = document.createElement('span');
  priceText.textContent = formatCurrencyCLP(raffle.ticketPrice);
  pricePill.appendChild(priceText);
  topBar.appendChild(pricePill);

  media.appendChild(topBar);

  // Badge de urgencia
  if (isEndingSoon) {
    const urgency = document.createElement('span');
    urgency.className =
      'absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ' +
      'bg-rose-600/90 backdrop-blur-sm text-white text-[11px] font-bold';
    urgency.innerHTML = renderIcon('flame', 'w-3 h-3');
    const urgencyText = document.createElement('span');
    urgencyText.textContent = t('card.endingSoon', { percentage: soldPercentage });
    urgency.appendChild(urgencyText);
    media.appendChild(urgency);
  }

  // Valor tasado superpuesto
  const valueBlock = document.createElement('div');
  valueBlock.className = 'absolute bottom-3 right-3 text-right';

  const valueLabel = document.createElement('p');
  valueLabel.className = 'text-[10px] uppercase tracking-wider text-slate-300 font-semibold';
  valueLabel.textContent = t('card.appraisedValue');

  const valueAmount = document.createElement('p');
  valueAmount.className = 'text-base sm:text-lg font-black text-white font-display drop-shadow-md';
  valueAmount.textContent = formatCurrencyCLP(raffle.houseValue.amount);

  valueBlock.append(valueLabel, valueAmount);

  if (raffle.houseValue.ufEquivalent !== undefined) {
    const ufValue = document.createElement('p');
    ufValue.className = 'text-[10px] text-indigo-300 font-mono';
    ufValue.textContent = formatUF(raffle.houseValue.ufEquivalent);
    valueBlock.appendChild(ufValue);
  }

  media.appendChild(valueBlock);

  return media;
}

function buildStatusPill(status: RaffleStatus): HTMLElement {
  const pill = document.createElement('span');
  const base =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-md';

  switch (status) {
    case RaffleStatus.ACTIVE:
      pill.className = `${base} bg-emerald-500/90 text-white`;
      pill.innerHTML = '<span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>';
      pill.appendChild(document.createTextNode(t('card.status.active')));
      return pill;
    case RaffleStatus.DRAWN:
      pill.className = `${base} bg-amber-500/95 text-slate-950 font-black`;
      pill.innerHTML = renderIcon('trophy', 'w-3 h-3');
      pill.appendChild(document.createTextNode(t('card.status.drawn')));
      return pill;
    case RaffleStatus.CANCELLED:
      pill.className = `${base} bg-slate-700/90 text-slate-200`;
      pill.innerHTML = renderIcon('close', 'w-3 h-3');
      pill.appendChild(document.createTextNode(t('card.status.cancelled')));
      return pill;
  }
}

// ── Zona de contenido ───────────────────────────────────────────

function buildContentSection(
  raffle: RaffleCatalogItem,
  summary: ReturnType<typeof summarizeRaffle>,
  progressPct: number,
): HTMLElement {
  const content = document.createElement('div');
  content.className = 'p-5 flex flex-col gap-3 flex-1';

  // Ubicación. Ciudad y región son datos de presentación: si el backend no
  // los emite, se muestra la dirección real de la vivienda, que sí viene en
  // el contrato, en vez de un "Ciudad por confirmar".
  const location = document.createElement('p');
  location.className = 'flex items-center gap-1.5 text-xs text-indigo-300 font-semibold';
  location.innerHTML = renderIcon('mapPin', 'w-3.5 h-3.5');
  const locationText = document.createElement('span');
  locationText.className = 'truncate';
  const place = [raffle.city, raffle.region].filter((part): part is string => part !== undefined);
  locationText.textContent = place.length > 0 ? place.join(', ') : raffle.houseAddress.value;
  location.appendChild(locationText);

  // Título
  const title = document.createElement('h3');
  title.className =
    'text-lg font-bold text-white font-display leading-snug line-clamp-2 min-h-[3.25rem] group-hover:text-indigo-300 transition-colors';
  title.textContent = raffle.title;

  content.append(location, title);

  // Bajada comercial: opcional en el contrato.
  if (raffle.tagline !== undefined) {
    const tagline = document.createElement('p');
    tagline.className = 'text-xs text-slate-400 leading-relaxed line-clamp-2 min-h-[2rem]';
    tagline.textContent = raffle.tagline;
    content.appendChild(tagline);
  }

  // Ficha técnica: idem. Un bloque ausente es mejor que uno con ceros.
  if (raffle.specs !== undefined) {
    content.appendChild(buildSpecsStrip(raffle.specs));
  }

  // Bloque inferior anclado
  const bottom = document.createElement('div');
  bottom.className = 'mt-auto pt-1 space-y-3';

  if (raffle.status === RaffleStatus.DRAWN && raffle.winner) {
    bottom.appendChild(buildWinnerBanner(raffle.winner.ticketNumber, raffle.winner.ownerId));
  } else {
    bottom.appendChild(buildProgressBlock(raffle, summary, progressPct));
  }

  bottom.appendChild(buildActionButton(raffle));
  content.appendChild(bottom);

  return content;
}

function buildSpecsStrip(specs: HouseSpecs): HTMLElement {
  const strip = document.createElement('div');
  strip.className =
    'grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-slate-950/70 border border-slate-800/80';

  const entries: ReadonlyArray<{ icon: string; value: string }> = [
    { icon: 'bed', value: t('card.specs.bedrooms', { count: specs.bedrooms }) },
    { icon: 'bath', value: t('card.specs.bathrooms', { count: specs.bathrooms }) },
    { icon: 'area', value: t('card.specs.area', { value: formatNumber(specs.areaSqM) }) },
  ];

  entries.forEach((entry) => {
    const cell = document.createElement('div');
    cell.className = 'flex items-center gap-1.5 text-[11px] text-slate-300';
    cell.innerHTML = renderIcon(entry.icon, 'w-3.5 h-3.5 text-indigo-400 shrink-0');
    const valueSpan = document.createElement('span');
    valueSpan.className = 'truncate';
    valueSpan.textContent = entry.value;
    cell.appendChild(valueSpan);
    strip.appendChild(cell);
  });

  return strip;
}

function buildProgressBlock(
  raffle: RaffleCatalogItem,
  summary: ReturnType<typeof summarizeRaffle>,
  progressPct: number,
): HTMLElement {
  const block = document.createElement('div');

  const labels = document.createElement('div');
  labels.className = 'flex justify-between gap-2 text-xs mb-1.5 whitespace-nowrap';

  const soldLabel = document.createElement('span');
  soldLabel.className = summary.canBeDrawn ? 'text-emerald-400 font-medium' : 'text-slate-400';
  soldLabel.textContent = t('card.sold', { count: formatNumber(summary.soldCount) });

  const availableLabel = document.createElement('span');
  availableLabel.className = 'text-slate-400';
  availableLabel.textContent = t('card.available', { count: formatNumber(summary.availableCount) });

  labels.append(soldLabel, availableLabel);

  // Barra con marca del mínimo notarial: el umbral legal se ve como una
  // línea ámbar sobre la barra, no como texto suelto.
  const track = document.createElement('div');
  track.className =
    'relative w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden';

  const fill = document.createElement('div');
  fill.className =
    'h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500';
  fill.style.width = `${progressPct}%`;
  track.appendChild(fill);

  const caption = document.createElement('div');
  caption.className = 'flex justify-between gap-2 text-[11px] mt-1.5 whitespace-nowrap';

  const minimumNote = document.createElement('span');
  if (summary.canBeDrawn) {
    minimumNote.className = 'flex items-center gap-1 text-emerald-400 font-semibold';
    minimumNote.innerHTML = renderIcon('checkCircle', 'w-3 h-3');
    minimumNote.appendChild(
      document.createTextNode(t('card.minimumReached', { count: formatNumber(raffle.minTicketsToDraw) })),
    );
  } else {
    minimumNote.className = 'text-amber-400';
    minimumNote.textContent = t('card.minimumMissing', {
      count: formatNumber(raffle.minTicketsToDraw - summary.soldCount),
    });
  }

  const countdown = document.createElement('span');
  countdown.className = 'text-slate-500';
  countdown.textContent = formatCountdown(raffle.endDate);

  caption.append(minimumNote, countdown);
  block.append(labels, track, caption);

  return block;
}

function buildWinnerBanner(ticketNumber: number, ownerId: string | undefined): HTMLElement {
  const banner = document.createElement('div');
  banner.className =
    'rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-600/10 border border-amber-500/30 p-3';

  const heading = document.createElement('p');
  heading.className = 'flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-300';
  heading.innerHTML = renderIcon('trophy', 'w-3.5 h-3.5');
  heading.appendChild(document.createTextNode(t('card.winningTicket')));

  const detail = document.createElement('p');
  detail.className = 'text-sm font-bold text-white font-mono mt-0.5';
  detail.textContent = formatTicketNumber(ticketNumber);

  banner.append(heading, detail);

  if (ownerId !== undefined) {
    const owner = document.createElement('p');
    owner.className = 'text-[11px] text-slate-400 truncate';
    owner.textContent = ownerId;
    banner.appendChild(owner);
  }

  return banner;
}

function buildActionButton(raffle: RaffleCatalogItem): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = 'view-detail';
  button.dataset.raffleId = raffle.id;

  const isActive = raffle.status === RaffleStatus.ACTIVE;
  button.className = isActive
    ? 'w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 ' +
      'hover:from-indigo-500 hover:to-indigo-600 text-white text-sm font-semibold py-2.5 transition-all ' +
      'group-hover:gap-2.5 active:scale-[0.98] cursor-pointer'
    : 'w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 ' +
      'text-slate-200 text-sm font-semibold py-2.5 transition-all active:scale-[0.98] cursor-pointer';

  const label = document.createElement('span');
  label.textContent = isActive ? t('card.action.participate') : t('card.action.viewResult');
  button.appendChild(label);
  button.insertAdjacentHTML('beforeend', renderIcon('arrowRight', 'w-4 h-4'));

  return button;
}
