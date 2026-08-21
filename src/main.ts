import './style.css';
import {
  RaffleBoardView,
  createDefaultFilters,
  type CatalogFilters,
  type DetailCallbacks,
  type DetailNotice,
} from './views/raffleBoard.view';
import { RaffleService } from './services/raffle.service';
import { ToastHost } from './components/NotificationToast';
import { getErrorMessage, formatTicketNumber, formatNumber } from './utils/format.utils';
import type { Raffle } from './models';
import type { DrawWinnerResult, BatchTicketResult } from './models/requests.model';

/**
 * Punto de entrada de ClickTuCasa Frontend.
 *
 * Cada flujo de negocio es `async` y vive dentro de un `try/catch`:
 * listar y ver el detalle se orquestan aquí; reservar, comprar y sortear
 * tienen el suyo dentro de sus componentes, para poder mostrar el error
 * junto al formulario que lo provocó.
 */

const toasts = new ToastHost();

const view = new RaffleBoardView(() => {
  void showRaffleList();
});

/** Catálogo ya cargado: permite filtrar sin volver a pedir los datos. */
let catalog: readonly Raffle[] = [];
let filters: CatalogFilters = createDefaultFilters();

// ── Flujo 1: catálogo ────────────────────────────────────────────

async function showRaffleList(): Promise<void> {
  view.showListLoading();

  try {
    catalog = await RaffleService.getAllRaffles();
    renderList();
  } catch (error: unknown) {
    console.error('[ClickTuCasa] Error al cargar el catálogo:', getErrorMessage(error));
    view.showListError(getErrorMessage(error), () => {
      void showRaffleList();
    });
  }
}

/** Repinta el catálogo con los filtros vigentes, sin tocar la red. */
function renderList(): void {
  view.renderRaffleList(catalog, filters, {
    onSelectRaffle: (raffleId: string) => {
      void showRaffleDetail(raffleId);
    },
    onFiltersChange: (next: CatalogFilters) => {
      filters = next;
      renderList();
    },
  });
}

// ── Flujo 2: detalle ─────────────────────────────────────────────

async function showRaffleDetail(raffleId: string): Promise<void> {
  view.showDetailLoading();

  try {
    const raffle = await RaffleService.getRaffleById(raffleId);
    view.renderRaffleDetail(raffle, buildDetailCallbacks());
  } catch (error: unknown) {
    console.error(
      `[ClickTuCasa] Error al cargar el detalle de la rifa "${raffleId}":`,
      getErrorMessage(error),
    );
    view.showDetailError(
      getErrorMessage(error),
      () => {
        void showRaffleDetail(raffleId);
      },
      () => {
        void showRaffleList();
      },
    );
  }
}

function buildDetailCallbacks(): DetailCallbacks {
  return {
    onBack: () => {
      void showRaffleList();
    },
    // ── Flujo 3: reservar la cesta ─────────────────────────────
    onReservationResult: (result: BatchTicketResult) => {
      handleBatchResult(result, {
        verbPast: 'reservado',
        successTitle: 'Reserva confirmada',
      });
    },
    // ── Flujo 4: comprar la cesta ──────────────────────────────
    onPurchaseResult: (result: BatchTicketResult) => {
      handleBatchResult(result, {
        verbPast: 'comprado',
        successTitle: '¡Compra confirmada!',
      });
    },
    // ── Flujo 5: sortear ───────────────────────────────────────
    onDrawSuccess: (result: DrawWinnerResult) => {
      toasts.show(
        '¡Sorteo realizado!',
        `Ganó el boleto ${formatTicketNumber(result.winnerTicket.number)}.`,
        'success',
      );
      view.renderRaffleDetail(result.raffle, buildDetailCallbacks(), {
        message: `¡Sorteo realizado ante notario! El boleto ganador es el ${formatTicketNumber(result.winnerTicket.number)}.`,
        tone: 'success',
      });
    },
  };
}

/**
 * Traduce el resultado de una operación en lote a un aviso para la persona.
 *
 * Como el backend expone un caso de uso por boleto, un lote puede quedar a
 * medias: eso se comunica explícitamente en vez de fingir que todo salió
 * bien o que todo falló.
 */
function handleBatchResult(
  result: BatchTicketResult,
  labels: { verbPast: string; successTitle: string },
): void {
  const { succeeded, failed } = result;
  let notice: DetailNotice;

  if (failed.length === 0) {
    const message = `Has ${labels.verbPast} ${formatNumber(succeeded.length)} ${succeeded.length === 1 ? 'boleto' : 'boletos'}: ${succeeded.map(formatTicketNumber).join(', ')}.`;
    notice = { message, tone: 'success' };
    toasts.show(labels.successTitle, message, 'success');
  } else if (succeeded.length === 0) {
    const firstReason = failed[0]?.reason ?? 'No fue posible completar la operación.';
    notice = { message: firstReason, tone: 'warning' };
    toasts.show('No se pudo completar', firstReason, 'error');
  } else {
    const message =
      `Se ${succeeded.length === 1 ? 'completó' : 'completaron'} ${formatNumber(succeeded.length)} de ` +
      `${formatNumber(succeeded.length + failed.length)} boletos. ` +
      `Sin procesar: ${failed.map((item) => formatTicketNumber(item.ticketNumber)).join(', ')}.`;
    notice = { message, tone: 'warning' };
    toasts.show('Resultado parcial', message, 'info');
  }

  view.renderRaffleDetail(result.raffle, buildDetailCallbacks(), notice);
}

// ── Bootstrap con Top-Level Await ────────────────────────────────
try {
  await showRaffleList();
} catch (error: unknown) {
  console.error('[ClickTuCasa] Error crítico al iniciar la aplicación:', getErrorMessage(error));
}
