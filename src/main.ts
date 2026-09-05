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
import {
  getErrorMessage,
  formatTicketNumber,
  formatNumber,
  formatTicketList,
} from './utils/format.utils';
import { applyInitialLocale, onLocaleChange, plural, t } from './i18n';
import type { Raffle, RaffleCatalogItem } from './models';
import type { DrawWinnerResult, BatchTicketResult } from './models/requests.model';
import type { TranslationKey } from './i18n/translations';

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
let catalog: readonly RaffleCatalogItem[] = [];
let filters: CatalogFilters = createDefaultFilters();

/**
 * Pantalla visible en este momento.
 *
 * Sin framework reactivo, cambiar de idioma exige saber qué hay dibujado
 * para volver a dibujarlo. Se guarda la rifa completa y no solo su id
 * para que traducir no dispare una petición de red: el idioma es un
 * cambio de presentación, no de datos.
 */
type Screen =
  | { kind: 'list' }
  | { kind: 'listError' }
  | { kind: 'detail'; raffle: Raffle }
  | { kind: 'detailError'; raffleId: string };
let currentScreen: Screen = { kind: 'list' };

// ── Flujo 1: catálogo ────────────────────────────────────────────

async function showRaffleList(): Promise<void> {
  view.showListLoading();

  try {
    catalog = await RaffleService.getAllRaffles();
    currentScreen = { kind: 'list' };
    renderList();
  } catch (error: unknown) {
    console.error('[ClickTuCasa] Catalogue load failed:', getErrorMessage(error));
    currentScreen = { kind: 'listError' };
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
    currentScreen = { kind: 'detail', raffle };
    view.renderRaffleDetail(raffle, buildDetailCallbacks());
  } catch (error: unknown) {
    console.error(`[ClickTuCasa] Raffle detail load failed for "${raffleId}":`, getErrorMessage(error));
    currentScreen = { kind: 'detailError', raffleId };
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
    onReservationResult: (result: BatchTicketResult, userId: string) => {
      handleBatchResult(result, userId, {
        one: 'result.reserved.one',
        other: 'result.reserved.other',
        successTitle: t('result.reserve.title'),
      });
    },
    // ── Flujo 4: comprar la cesta ──────────────────────────────
    onPurchaseResult: (result: BatchTicketResult, userId: string) => {
      handleBatchResult(result, userId, {
        one: 'result.purchased.one',
        other: 'result.purchased.other',
        successTitle: t('result.purchase.title'),
      });
    },
    // ── Flujo 5: sortear ───────────────────────────────────────
    onDrawSuccess: (result: DrawWinnerResult) => {
      toasts.show(
        t('result.draw.title'),
        t('result.draw.toast', { ticket: formatTicketNumber(result.winnerTicket.number) }),
        'success',
      );
      currentScreen = { kind: 'detail', raffle: result.raffle };
      view.renderRaffleDetail(result.raffle, buildDetailCallbacks(), {
        message: t('result.draw.notice', {
          ticket: formatTicketNumber(result.winnerTicket.number),
        }),
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
  userId: string,
  labels: { one: TranslationKey; other: TranslationKey; successTitle: string },
): void {
  const { succeeded, failed } = result;
  let notice: DetailNotice;

  if (failed.length === 0) {
    const message = plural(labels.one, labels.other, succeeded.length, {
      count: formatNumber(succeeded.length),
      list: formatTicketList(succeeded),
    });
    notice = { message, tone: 'success' };
    toasts.show(labels.successTitle, message, 'success');
  } else if (succeeded.length === 0) {
    const firstReason = failed[0]?.reason ?? t('result.failedFallback');
    notice = { message: firstReason, tone: 'warning' };
    toasts.show(t('result.failedTitle'), firstReason, 'error');
  } else {
    const message = t('result.partial', {
      done: formatNumber(succeeded.length),
      total: formatNumber(succeeded.length + failed.length),
      list: formatTicketList(failed.map((item) => item.ticketNumber)),
    });
    notice = { message, tone: 'warning' };
    toasts.show(t('result.partialTitle'), message, 'info');
  }

  // El `userId` viaja hasta la vista: es lo que le permite a la grilla
  // reconocer las reservas propias y dejar comprarlas.
  currentScreen = { kind: 'detail', raffle: result.raffle };
  view.renderRaffleDetail(result.raffle, buildDetailCallbacks(), notice, userId);
}

// ── Cambio de idioma ─────────────────────────────────────────────
//
// La aplicación no usa framework, así que traducir en caliente significa
// volver a construir lo que hay en pantalla. Se hace SIN red: el catálogo
// y la rifa abierta ya están en memoria, y el idioma solo cambia cómo se
// escriben, no lo que dicen los datos.
onLocaleChange(() => {
  view.refreshChrome();

  switch (currentScreen.kind) {
    case 'detail':
      view.renderRaffleDetail(currentScreen.raffle, buildDetailCallbacks());
      return;
    case 'list':
      renderList();
      return;
    // Los mensajes de error nacen ya traducidos, en el idioma que estaba
    // activo cuando falló la petición. Reintentarla es la única forma
    // honesta de mostrarlos en el nuevo idioma — y de paso, si el backend
    // ya volvió, la persona recupera la pantalla en vez del error.
    case 'listError':
      void showRaffleList();
      return;
    case 'detailError':
      void showRaffleDetail(currentScreen.raffleId);
      return;
  }
});

// ── Bootstrap con Top-Level Await ────────────────────────────────
applyInitialLocale();

try {
  await showRaffleList();
} catch (error: unknown) {
  console.error('[ClickTuCasa] Fatal error while starting the app:', getErrorMessage(error));
}
