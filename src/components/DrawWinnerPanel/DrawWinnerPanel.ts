import { RaffleService } from '../../services/raffle.service';
import { type Raffle, RaffleStatus, TicketStatus, canBeDrawn } from '../../models';
import type { DrawWinnerResult } from '../../models/requests.model';
import {
  getErrorMessage,
  formatTicketNumber,
  formatNumber,
} from '../../utils/format.utils';
import { renderIcon } from '../../utils/icon.utils';
import { t } from '../../i18n';

export interface DrawWinnerPanelHandle {
  element: HTMLElement;
}

/**
 * Panel administrativo de sorteo.
 *
 * El botón solo existe si la rifa cumple `canBeDrawn()` — misma regla que
 * `Raffle.canBeDrawn()` del backend. No hay autenticación: el alcance del
 * proyecto es el motor de rifas, no la gestión de identidades. La autoridad
 * real sigue siendo el backend, que rechaza el sorteo si no corresponde.
 */
export function createDrawWinnerPanelElement(
  raffle: Raffle,
  onSuccess: (result: DrawWinnerResult) => void,
): DrawWinnerPanelHandle {
  const container = document.createElement('section');
  container.className =
    'rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/30 p-5';

  const header = document.createElement('div');
  header.className = 'flex items-center gap-2 mb-3';
  header.innerHTML = renderIcon('trophy', 'w-4 h-4 text-amber-400');

  const title = document.createElement('h3');
  title.className = 'text-base font-bold text-white font-display';
  title.textContent = t('draw.title');
  header.appendChild(title);

  container.appendChild(header);

  const feedback = document.createElement('p');
  feedback.className = 'hidden text-xs mb-3';
  container.appendChild(feedback);

  // ── Rifa ya sorteada ───────────────────────────────────────────
  if (raffle.status === RaffleStatus.DRAWN && raffle.winner) {
    container.appendChild(buildWinnerResult(raffle.winner));
    return { element: container };
  }

  // ── Rifa que aún no cumple el mínimo ───────────────────────────
  if (!canBeDrawn(raffle)) {
    const soldCount = raffle.tickets.filter((t) => t.status === TicketStatus.SOLD).length;
    const missing = Math.max(0, raffle.minTicketsToDraw - soldCount);

    const info = document.createElement('p');
    info.className = 'text-xs text-slate-400 leading-relaxed';
    info.textContent = t('draw.notYet', {
      sold: formatNumber(soldCount),
      minimum: formatNumber(raffle.minTicketsToDraw),
      missing: formatNumber(missing),
    });
    container.appendChild(info);
    return { element: container };
  }

  // ── Rifa elegible ──────────────────────────────────────────────
  const drawButton = document.createElement('button');
  drawButton.type = 'button';
  drawButton.className =
    'w-full rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 ' +
    'hover:from-amber-400 hover:to-indigo-500 text-slate-950 text-sm font-black py-2.5 ' +
    'transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
  drawButton.textContent = t('draw.submit');

  async function handleDraw(): Promise<void> {
    const originalLabel = drawButton.textContent ?? t('draw.submit');
    drawButton.disabled = true;
    drawButton.textContent = t('draw.submitting');
    feedback.className = 'text-xs text-slate-400 mb-3';
    feedback.textContent = t('draw.working');

    try {
      const result = await RaffleService.drawWinner(raffle.id);
      onSuccess(result);
    } catch (error: unknown) {
      feedback.className = 'text-xs text-rose-400 mb-3';
      feedback.textContent = getErrorMessage(error);
      drawButton.disabled = false;
      drawButton.textContent = originalLabel;
    }
  }

  drawButton.addEventListener('click', () => {
    void handleDraw();
  });

  container.appendChild(drawButton);

  return { element: container };
}

function buildWinnerResult(winner: NonNullable<Raffle['winner']>): HTMLElement {
  const result = document.createElement('div');
  result.className =
    'rounded-xl bg-emerald-950/50 border border-emerald-800 p-4 space-y-2 animate-zoom-in';

  const heading = document.createElement('p');
  heading.className = 'font-bold text-emerald-300';
  heading.textContent = t('draw.done');

  const ticketLine = document.createElement('p');
  ticketLine.className = 'text-2xl font-black text-white font-mono tracking-wider';
  ticketLine.textContent = formatTicketNumber(winner.ticketNumber);

  result.append(heading, ticketLine);

  // El titular solo se conoce en la vista de detalle, donde sí llega la
  // grilla de boletos. La fecha y el hash del acta no forman parte del
  // contrato del backend, así que no se muestran en vez de inventarse.
  if (winner.ownerId !== undefined) {
    const ownerLine = document.createElement('p');
    ownerLine.className = 'text-sm text-slate-300 break-all';
    // textContent, nunca innerHTML: `ownerId` proviene de lo que escribe
    // la persona en el formulario de compra.
    ownerLine.textContent = t('draw.holder', { owner: winner.ownerId });
    result.appendChild(ownerLine);
  }

  return result;
}
