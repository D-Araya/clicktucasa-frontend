import { RaffleService } from '../../services/raffle.service';
import { type Raffle, RaffleStatus, TicketStatus, canBeDrawn } from '../../models';
import type { DrawWinnerResult } from '../../models/requests.model';
import {
  getErrorMessage,
  formatTicketNumber,
  formatNumber,
  formatDate,
} from '../../utils/format.utils';
import { renderIcon } from '../../utils/icon.utils';

export interface DrawWinnerPanelHandle {
  element: HTMLElement;
}

/**
 * Panel administrativo de sorteo.
 *
 * El botón solo existe si la rifa cumple `canBeDrawn()` — misma regla que
 * `Raffle.canBeDrawn()` del backend. No hay autenticación real: el alcance
 * del Hito 2 lo permite explícitamente.
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
  title.textContent = 'Panel de administrador — Sorteo';
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
    info.textContent =
      `Esta rifa aún no puede sortearse: lleva ${formatNumber(soldCount)} de ` +
      `${formatNumber(raffle.minTicketsToDraw)} boletos vendidos (faltan ${formatNumber(missing)}).`;
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
  drawButton.textContent = 'Sortear ganador ante notario';

  async function handleDraw(): Promise<void> {
    const originalLabel = drawButton.textContent ?? 'Sortear ganador';
    drawButton.disabled = true;
    drawButton.textContent = 'Sorteando...';
    feedback.className = 'text-xs text-slate-400 mb-3';
    feedback.textContent = 'Seleccionando un boleto ganador entre los vendidos...';

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
  heading.textContent = '¡Rifa sorteada!';

  const ticketLine = document.createElement('p');
  ticketLine.className = 'text-2xl font-black text-white font-mono tracking-wider';
  ticketLine.textContent = formatTicketNumber(winner.ticketNumber);

  const ownerLine = document.createElement('p');
  ownerLine.className = 'text-sm text-slate-300 break-all';
  // textContent, nunca innerHTML: `ownerId` proviene de lo que escribe
  // la persona en el formulario de compra.
  ownerLine.textContent = `Titular: ${winner.ownerId}`;

  const dateLine = document.createElement('p');
  dateLine.className = 'text-[11px] text-slate-500';
  dateLine.textContent = `Sorteado el ${formatDate(winner.drawnAt)}`;

  const hashBlock = document.createElement('p');
  hashBlock.className =
    'p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400 break-all select-all';
  hashBlock.textContent = `Hash del acta: ${winner.verificationHash}`;

  result.append(heading, ticketLine, ownerLine, dateLine, hashBlock);
  return result;
}
