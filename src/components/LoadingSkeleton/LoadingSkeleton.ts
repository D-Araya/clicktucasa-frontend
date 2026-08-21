/** Esqueletos de carga reutilizables (Pilar 3: feedback antes de resolver). */

export function createRaffleListSkeleton(count: number = 3): DocumentFragment {
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className =
      'rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden animate-pulse';
    card.innerHTML = `
      <div class="aspect-[16/10] bg-slate-800"></div>
      <div class="p-5 space-y-3">
        <div class="h-3 w-1/3 bg-slate-800 rounded"></div>
        <div class="h-5 w-3/4 bg-slate-800 rounded"></div>
        <div class="h-3 w-full bg-slate-800 rounded"></div>
        <div class="h-12 w-full bg-slate-800 rounded-xl"></div>
        <div class="h-2.5 w-full bg-slate-800 rounded-full"></div>
        <div class="h-10 w-full bg-slate-800 rounded-xl"></div>
      </div>
    `;
    fragment.appendChild(card);
  }

  return fragment;
}

export function createTicketGridSkeleton(count: number = 60): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-4';

  const header = document.createElement('div');
  header.className = 'h-24 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse';

  const grid = document.createElement('div');
  grid.className =
    'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800';

  for (let i = 0; i < count; i++) {
    const cell = document.createElement('div');
    cell.className = 'h-10 rounded-lg bg-slate-800 animate-pulse';
    grid.appendChild(cell);
  }

  wrapper.append(header, grid);
  return wrapper;
}

/** Spinner en línea con un mensaje, para bloques que aún cargan. */
export function createInlineSpinner(message: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-center justify-center gap-3 py-10 text-slate-400';

  const spinner = document.createElement('span');
  spinner.className =
    'w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin';

  const text = document.createElement('span');
  text.className = 'text-sm';
  text.textContent = message;

  wrapper.append(spinner, text);
  return wrapper;
}
