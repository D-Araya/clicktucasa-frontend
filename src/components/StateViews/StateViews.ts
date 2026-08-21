import { renderIcon } from '../../utils/icon.utils';

/** Vistas de estado vacío / error, con acción de recuperación (Pilar 3). */

export function createEmptyStateElement(
  message: string = 'No hay propiedades que coincidan con tu búsqueda.',
  actionLabel?: string,
  onAction?: () => void,
): HTMLElement {
  const container = document.createElement('div');
  container.className =
    'col-span-full flex flex-col items-center text-center py-14 px-6 bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl animate-fade-in';

  const iconBox = document.createElement('div');
  iconBox.className =
    'w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4';
  iconBox.innerHTML = renderIcon('search', 'w-6 h-6');

  const title = document.createElement('p');
  title.className = 'font-bold text-slate-200 font-display';
  title.textContent = 'Sin resultados';

  const detail = document.createElement('p');
  detail.className = 'text-sm text-slate-400 mt-1 max-w-md';
  detail.textContent = message;

  container.append(iconBox, title, detail);

  if (actionLabel && onAction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className =
      'mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-950 text-sm font-semibold hover:bg-white transition-colors cursor-pointer';
    button.innerHTML = renderIcon('reset', 'w-4 h-4');
    button.appendChild(document.createTextNode(actionLabel));
    button.addEventListener('click', () => onAction());
    container.appendChild(button);
  }

  return container;
}

export function createErrorStateElement(message: string, onRetry?: () => void): HTMLElement {
  const container = document.createElement('div');
  container.className =
    'col-span-full flex flex-col items-center text-center py-14 px-6 bg-rose-950/20 border border-dashed border-rose-900 rounded-2xl animate-fade-in';

  const iconBox = document.createElement('div');
  iconBox.className =
    'w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4';
  iconBox.innerHTML = renderIcon('alert', 'w-6 h-6');

  const title = document.createElement('p');
  title.className = 'font-bold text-rose-300 font-display';
  title.textContent = '¡Ups! Ocurrió un problema.';

  const detail = document.createElement('p');
  detail.className = 'text-sm text-slate-400 mt-1 max-w-md';
  detail.textContent = message;

  container.append(iconBox, title, detail);

  if (onRetry) {
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className =
      'mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-950 text-sm font-semibold hover:bg-white transition-colors cursor-pointer';
    retryButton.innerHTML = renderIcon('refresh', 'w-4 h-4');
    retryButton.appendChild(document.createTextNode('Reintentar'));
    retryButton.addEventListener('click', () => onRetry());
    container.appendChild(retryButton);
  }

  return container;
}

/** Cabecera de una sección del catálogo, con contador. */
export function createSectionHeader(
  icon: string,
  title: string,
  subtitle: string,
  count: number,
  tone: 'emerald' | 'amber' | 'slate',
): HTMLElement {
  const tones: Record<typeof tone, string> = {
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    slate: 'bg-slate-800 border-slate-700 text-slate-300',
  };

  const header = document.createElement('div');
  header.className = 'flex items-center gap-3 mb-4';

  const iconBox = document.createElement('div');
  iconBox.className = `w-9 h-9 rounded-xl border flex items-center justify-center ${tones[tone]}`;
  iconBox.innerHTML = renderIcon(icon, 'w-4 h-4');

  const textBlock = document.createElement('div');
  textBlock.className = 'flex-1';

  const titleRow = document.createElement('div');
  titleRow.className = 'flex items-center gap-2';

  const titleElement = document.createElement('h2');
  titleElement.className = 'text-xl font-black text-white font-display';
  titleElement.textContent = title;

  const countPill = document.createElement('span');
  countPill.className = `text-[11px] font-bold font-mono px-2 py-0.5 rounded-full border ${tones[tone]}`;
  countPill.textContent = String(count);

  titleRow.append(titleElement, countPill);

  const subtitleElement = document.createElement('p');
  subtitleElement.className = 'text-xs text-slate-500';
  subtitleElement.textContent = subtitle;

  textBlock.append(titleRow, subtitleElement);
  header.append(iconBox, textBlock);

  return header;
}
