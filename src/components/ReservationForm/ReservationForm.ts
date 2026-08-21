import { RaffleService } from '../../services/raffle.service';
import { APP_CONFIG } from '../../config/app.config';
import type { Raffle } from '../../models';
import type { BatchTicketResult } from '../../models/requests.model';
import { formatNumber, getErrorMessage } from '../../utils/format.utils';
import {
  validateFullName,
  validateEmail,
  validateIntegerInRange,
} from '../../utils/validation.utils';
import { createFormField } from '../FormField';
import { renderIcon } from '../../utils/icon.utils';

export interface ReservationFormHandle {
  element: HTMLElement;
  setSelection: (selected: readonly number[]) => void;
}

/**
 * Reserva temporal de los boletos que están en la cesta.
 *
 * Pilar 2: `event.preventDefault()` es la primera instrucción del listener,
 * los valores se leen con aserciones de tipo especializadas, y cada campo
 * pasa por tres capas de validación (presencia → formato → rango) antes de
 * que se dispare la petición.
 */
export function createReservationFormElement(
  raffle: Raffle,
  onResult: (result: BatchTicketResult, userId: string) => void,
): ReservationFormHandle {
  let selection: readonly number[] = [];

  const section = document.createElement('section');
  section.className = 'bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col';

  const heading = document.createElement('h3');
  heading.className = 'flex items-center gap-2 text-base font-bold text-white font-display mb-1';
  heading.innerHTML = renderIcon('clock', 'w-4 h-4 text-amber-400');
  heading.appendChild(document.createTextNode('Reservar sin pagar'));

  const subtitle = document.createElement('p');
  subtitle.className = 'text-[11px] text-slate-500 mb-4';
  subtitle.textContent = 'Bloquea tus boletos unos minutos y completa la compra después.';

  const form = document.createElement('form');
  form.id = `form-reservar-${raffle.id}`;
  form.noValidate = true;
  form.className = 'space-y-3 flex-1 flex flex-col';

  const nameField = createFormField({
    id: `reservar-nombre-${raffle.id}`,
    label: 'Nombre completo',
    placeholder: 'Ada Lovelace',
    validate: validateFullName,
  });

  const emailField = createFormField({
    id: `reservar-email-${raffle.id}`,
    label: 'Correo electrónico',
    type: 'email',
    placeholder: 'nombre@correo.cl',
    validate: validateEmail,
  });

  const durationField = createFormField({
    id: `reservar-duracion-${raffle.id}`,
    label: 'Duración de la reserva (minutos)',
    type: 'number',
    initialValue: String(APP_CONFIG.DEFAULT_RESERVATION_MINUTES),
    hint: `Entre ${APP_CONFIG.MIN_RESERVATION_MINUTES} y ${APP_CONFIG.MAX_RESERVATION_MINUTES} minutos.`,
    validate: (value) =>
      validateIntegerInRange(
        value,
        APP_CONFIG.MIN_RESERVATION_MINUTES,
        APP_CONFIG.MAX_RESERVATION_MINUTES,
        'La duración',
      ),
  });

  const feedback = document.createElement('p');
  feedback.className = 'hidden text-xs';

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className =
    'mt-auto w-full rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold py-2.5 ' +
    'transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  form.append(
    nameField.element,
    emailField.element,
    durationField.element,
    feedback,
    submitButton,
  );
  section.append(heading, subtitle, form);

  const showFeedback = (message: string, tone: 'error' | 'success'): void => {
    feedback.textContent = message;
    feedback.className =
      tone === 'error' ? 'text-xs text-rose-400' : 'text-xs text-emerald-400';
  };

  const clearFeedback = (): void => {
    feedback.textContent = '';
    feedback.classList.add('hidden');
  };

  const setSelection = (selected: readonly number[]): void => {
    selection = selected;
    submitButton.disabled = selected.length === 0;
    submitButton.textContent =
      selected.length === 0
        ? 'Selecciona al menos un boleto'
        : `Reservar ${formatNumber(selected.length)} ${selected.length === 1 ? 'boleto' : 'boletos'}`;
  };

  async function submitReservation(userId: string, durationMinutes: number): Promise<void> {
    const originalLabel = submitButton.textContent ?? 'Reservar';
    submitButton.disabled = true;
    submitButton.textContent = 'Reservando...';
    showFeedback(`Bloqueando ${formatNumber(selection.length)} boletos...`, 'success');

    try {
      const result = await RaffleService.reserveTickets(
        raffle.id,
        selection,
        userId,
        durationMinutes,
      );
      onResult(result, userId);
    } catch (error: unknown) {
      showFeedback(getErrorMessage(error), 'error');
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  }

  form.addEventListener('submit', (event: Event) => {
    // Primera instrucción, siempre: el navegador nunca debe recargar
    // la página por su cuenta, ni siquiera si algo más falla debajo.
    event.preventDefault();
    clearFeedback();

    if (selection.length === 0) {
      showFeedback('Selecciona al menos un boleto en la grilla.', 'error');
      return;
    }

    const nameResult = nameField.validate();
    const emailResult = emailField.validate();
    const durationResult = durationField.validate();

    if (!nameResult.isValid) {
      nameField.focus();
      return;
    }
    if (!emailResult.isValid) {
      emailField.focus();
      return;
    }
    if (!durationResult.isValid) {
      durationField.focus();
      return;
    }

    const userId = emailResult.formatted ?? emailField.value().trim();
    const durationMinutes = parseInt(durationResult.formatted ?? durationField.value(), 10);

    void submitReservation(userId, durationMinutes);
  });

  setSelection([]);

  return { element: section, setSelection };
}
