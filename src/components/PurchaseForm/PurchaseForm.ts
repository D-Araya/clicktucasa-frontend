import { RaffleService } from '../../services/raffle.service';
import type { Raffle } from '../../models';
import {
  type BatchTicketResult,
  PaymentMethod,
  PAYMENT_METHOD_LABELS,
} from '../../models/requests.model';
import { formatNumber, formatCurrencyCLP, getErrorMessage } from '../../utils/format.utils';
import {
  validateFullName,
  validateEmail,
  validateRut,
  validateChileanPhone,
  formatRut,
  formatChileanPhone,
} from '../../utils/validation.utils';
import { createFormField } from '../FormField';
import { renderIcon } from '../../utils/icon.utils';

export interface PurchaseFormHandle {
  element: HTMLElement;
  setSelection: (selected: readonly number[]) => void;
}

/**
 * Compra de los boletos que están en la cesta.
 *
 * Además de las tres capas de validación, aplica las reglas propias del
 * mercado chileno: RUT verificado con módulo 11 y móvil de nueve dígitos
 * que comienza en 9, ambos autoformateados mientras la persona escribe.
 */
export function createPurchaseFormElement(
  raffle: Raffle,
  onResult: (result: BatchTicketResult, userId: string) => void,
): PurchaseFormHandle {
  let selection: readonly number[] = [];
  let paymentMethod: PaymentMethod = PaymentMethod.WEBPAY;

  const section = document.createElement('section');
  section.className =
    'bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col lg:col-span-2';

  const heading = document.createElement('h3');
  heading.className = 'flex items-center gap-2 text-base font-bold text-white font-display mb-1';
  heading.innerHTML = renderIcon('shield', 'w-4 h-4 text-emerald-400');
  heading.appendChild(document.createTextNode('Comprar y quedar inscrito'));

  const subtitle = document.createElement('p');
  subtitle.className = 'text-[11px] text-slate-500 mb-4';
  subtitle.textContent =
    'Los datos del titular quedan registrados en el acta notarial del sorteo.';

  const form = document.createElement('form');
  form.id = `form-comprar-${raffle.id}`;
  form.noValidate = true;
  form.className = 'space-y-3 flex-1 flex flex-col';

  // ── Resumen de la cesta ────────────────────────────────────────
  const cartSummary = document.createElement('div');
  cartSummary.className =
    'flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5';

  const cartCount = document.createElement('span');
  cartCount.className = 'text-xs text-slate-400';

  const cartTotal = document.createElement('span');
  cartTotal.className = 'text-lg font-black text-indigo-400 font-display font-mono';

  cartSummary.append(cartCount, cartTotal);

  // ── Campos ─────────────────────────────────────────────────────
  const fieldsGrid = document.createElement('div');
  fieldsGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-3';

  const nameField = createFormField({
    id: `comprar-nombre-${raffle.id}`,
    label: 'Nombre completo',
    placeholder: 'Ada Lovelace',
    validate: validateFullName,
  });

  const emailField = createFormField({
    id: `comprar-email-${raffle.id}`,
    label: 'Correo electrónico',
    type: 'email',
    placeholder: 'nombre@correo.cl',
    validate: validateEmail,
  });

  const rutField = createFormField({
    id: `comprar-rut-${raffle.id}`,
    label: 'RUT',
    placeholder: '12.345.678-5',
    validate: validateRut,
    liveFormat: formatRut,
  });

  const phoneField = createFormField({
    id: `comprar-telefono-${raffle.id}`,
    label: 'Teléfono móvil',
    placeholder: '+56 9 1234 5678',
    validate: validateChileanPhone,
    liveFormat: formatChileanPhone,
  });

  fieldsGrid.append(nameField.element, emailField.element, rutField.element, phoneField.element);

  // ── Medio de pago ──────────────────────────────────────────────
  const paymentBlock = document.createElement('div');

  const paymentLabel = document.createElement('p');
  paymentLabel.className = 'block text-xs font-semibold text-slate-300 mb-1.5';
  paymentLabel.textContent = 'Medio de pago';

  const paymentGrid = document.createElement('div');
  paymentGrid.className = 'grid grid-cols-2 sm:grid-cols-4 gap-2';
  paymentGrid.setAttribute('role', 'radiogroup');
  paymentGrid.setAttribute('aria-label', 'Medio de pago');

  const paymentButtons = new Map<PaymentMethod, HTMLButtonElement>();

  const paintPaymentButtons = (): void => {
    paymentButtons.forEach((button, method) => {
      const isActive = method === paymentMethod;
      button.className = isActive
        ? 'rounded-xl border border-indigo-500 bg-indigo-950/70 text-white px-3 py-2 text-xs font-semibold shadow transition-all cursor-pointer'
        : 'rounded-xl border border-slate-800 bg-slate-950 text-slate-400 px-3 py-2 text-xs font-semibold hover:border-slate-700 transition-all cursor-pointer';
      button.setAttribute('aria-checked', String(isActive));
    });
  };

  Object.values(PaymentMethod).forEach((method) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.textContent = PAYMENT_METHOD_LABELS[method];
    button.addEventListener('click', () => {
      paymentMethod = method;
      paintPaymentButtons();
    });
    paymentButtons.set(method, button);
    paymentGrid.appendChild(button);
  });

  paintPaymentButtons();
  paymentBlock.append(paymentLabel, paymentGrid);

  // ── Aceptación de bases ────────────────────────────────────────
  const termsLabel = document.createElement('label');
  termsLabel.className = 'flex items-start gap-2 text-[11px] text-slate-400 cursor-pointer';

  const termsCheckbox = document.createElement('input');
  termsCheckbox.type = 'checkbox';
  termsCheckbox.id = `comprar-bases-${raffle.id}`;
  termsCheckbox.className = 'mt-0.5 accent-indigo-500 cursor-pointer';

  const termsText = document.createElement('span');
  termsText.textContent =
    'Acepto las bases notariales del sorteo y autorizo el registro de mis datos en el acta.';

  termsLabel.append(termsCheckbox, termsText);

  const feedback = document.createElement('p');
  feedback.className = 'hidden text-xs';

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className =
    'mt-auto w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 ' +
    'hover:from-indigo-500 hover:to-emerald-400 text-white text-sm font-bold py-2.5 transition-all ' +
    'active:scale-[0.99] cursor-pointer disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 ' +
    'disabled:cursor-not-allowed';

  form.append(cartSummary, fieldsGrid, paymentBlock, termsLabel, feedback, submitButton);
  section.append(heading, subtitle, form);

  const showFeedback = (message: string, tone: 'error' | 'success'): void => {
    feedback.textContent = message;
    feedback.className = tone === 'error' ? 'text-xs text-rose-400' : 'text-xs text-emerald-400';
  };

  const clearFeedback = (): void => {
    feedback.textContent = '';
    feedback.classList.add('hidden');
  };

  const setSelection = (selected: readonly number[]): void => {
    selection = selected;
    cartCount.textContent =
      selected.length === 0
        ? 'Sin boletos seleccionados'
        : `${formatNumber(selected.length)} ${selected.length === 1 ? 'boleto' : 'boletos'} en la cesta`;
    cartTotal.textContent = formatCurrencyCLP(selected.length * raffle.ticketPrice);
    submitButton.disabled = selected.length === 0;
    submitButton.textContent =
      selected.length === 0
        ? 'Selecciona al menos un boleto'
        : `Pagar ${formatCurrencyCLP(selected.length * raffle.ticketPrice)}`;
  };

  async function submitPurchase(buyer: {
    userId: string;
    buyerName: string;
    buyerRut: string;
    buyerPhone: string;
  }): Promise<void> {
    const originalLabel = submitButton.textContent ?? 'Pagar';
    submitButton.disabled = true;
    submitButton.textContent = 'Procesando pago...';
    showFeedback('Contactando la pasarela de pago...', 'success');

    try {
      const result = await RaffleService.purchaseTickets(raffle.id, selection, {
        userId: buyer.userId,
        buyerName: buyer.buyerName,
        buyerRut: buyer.buyerRut,
        buyerPhone: buyer.buyerPhone,
        paymentMethod,
      });
      onResult(result, buyer.userId);
    } catch (error: unknown) {
      showFeedback(getErrorMessage(error), 'error');
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  }

  form.addEventListener('submit', (event: Event) => {
    event.preventDefault();
    clearFeedback();

    if (selection.length === 0) {
      showFeedback('Selecciona al menos un boleto en la grilla.', 'error');
      return;
    }

    const nameResult = nameField.validate();
    const emailResult = emailField.validate();
    const rutResult = rutField.validate();
    const phoneResult = phoneField.validate();

    if (!nameResult.isValid) {
      nameField.focus();
      return;
    }
    if (!emailResult.isValid) {
      emailField.focus();
      return;
    }
    if (!rutResult.isValid) {
      rutField.focus();
      return;
    }
    if (!phoneResult.isValid) {
      phoneField.focus();
      return;
    }
    if (!termsCheckbox.checked) {
      showFeedback('Debes aceptar las bases notariales para continuar.', 'error');
      termsCheckbox.focus();
      return;
    }

    void submitPurchase({
      userId: emailResult.formatted ?? emailField.value().trim(),
      buyerName: nameResult.formatted ?? nameField.value().trim(),
      buyerRut: rutResult.formatted ?? rutField.value().trim(),
      buyerPhone: phoneResult.formatted ?? phoneField.value().trim(),
    });
  });

  setSelection([]);

  return { element: section, setSelection };
}
