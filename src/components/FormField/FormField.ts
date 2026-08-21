import type { ValidationResult } from '../../utils/validation.utils';
import { renderIcon } from '../../utils/icon.utils';

export interface FieldConfig {
  readonly id: string;
  readonly label: string;
  readonly placeholder?: string;
  readonly type?: string;
  readonly initialValue?: string;
  readonly hint?: string;
  /** Regla de validación del campo. */
  readonly validate: (value: string) => ValidationResult;
  /** Formateo progresivo mientras la persona escribe (RUT, teléfono...). */
  readonly liveFormat?: (value: string) => string;
}

export interface FieldHandle {
  readonly element: HTMLElement;
  readonly input: HTMLInputElement;
  /** Valida y pinta el estado; devuelve el resultado para decidir el envío. */
  validate: () => ValidationResult;
  value: () => string;
  focus: () => void;
}

/**
 * Campo de formulario con validación en tres estados visuales
 * (neutro / error / válido).
 *
 * Centralizar el patrón aquí evita repetir la misma lógica de clases,
 * mensajes y foco en cada formulario, y garantiza que todos los campos
 * de la aplicación se comporten igual.
 */
export function createFormField(config: FieldConfig): FieldHandle {
  const wrapper = document.createElement('div');

  const label = document.createElement('label');
  label.className = 'block text-xs font-semibold text-slate-300 mb-1';
  label.htmlFor = config.id;
  label.textContent = config.label;

  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'relative';

  const input = document.createElement('input');
  input.id = config.id;
  input.type = config.type ?? 'text';
  input.value = config.initialValue ?? '';
  input.placeholder = config.placeholder ?? '';
  input.autocomplete = 'off';

  const validIcon = document.createElement('span');
  validIcon.className =
    'hidden absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none';
  validIcon.innerHTML = renderIcon('checkCircle', 'w-4 h-4');

  inputWrapper.append(input, validIcon);

  const errorElement = document.createElement('p');
  errorElement.className = 'hidden items-center gap-1 text-[11px] text-rose-400 mt-1';

  wrapper.append(label, inputWrapper);

  if (config.hint) {
    const hint = document.createElement('p');
    hint.className = 'text-[11px] text-slate-500 mt-1';
    hint.textContent = config.hint;
    wrapper.appendChild(hint);
  }

  wrapper.appendChild(errorElement);

  const NEUTRAL =
    'w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 ' +
    'placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors';
  const ERROR =
    'w-full rounded-xl bg-slate-950 border border-rose-500 px-3 py-2.5 text-sm text-slate-100 ' +
    'placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-rose-500/20 transition-colors';
  const VALID =
    'w-full rounded-xl bg-slate-950 border border-emerald-500 pl-3 pr-9 py-2.5 text-sm text-slate-100 ' +
    'placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors';

  input.className = NEUTRAL;

  let isTouched = false;

  const paint = (result: ValidationResult): void => {
    if (!isTouched) {
      input.className = NEUTRAL;
      validIcon.classList.add('hidden');
      errorElement.classList.add('hidden');
      return;
    }

    if (result.isValid) {
      input.className = VALID;
      validIcon.classList.remove('hidden');
      errorElement.classList.add('hidden');
      errorElement.textContent = '';
      return;
    }

    input.className = ERROR;
    validIcon.classList.add('hidden');
    errorElement.className = 'flex items-center gap-1 text-[11px] text-rose-400 mt-1';
    errorElement.replaceChildren();
    errorElement.insertAdjacentHTML('beforeend', renderIcon('alert', 'w-3 h-3 shrink-0'));
    const message = document.createElement('span');
    message.textContent = result.error ?? 'Revisa este campo.';
    errorElement.appendChild(message);
  };

  input.addEventListener('input', () => {
    if (config.liveFormat) {
      const cursorAtEnd = input.selectionStart === input.value.length;
      input.value = config.liveFormat(input.value);
      if (cursorAtEnd) {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
    if (isTouched) {
      paint(config.validate(input.value));
    }
  });

  input.addEventListener('blur', () => {
    if (input.value.trim().length === 0 && !isTouched) {
      return;
    }
    isTouched = true;
    paint(config.validate(input.value));
  });

  return {
    element: wrapper,
    input,
    validate: () => {
      isTouched = true;
      const result = config.validate(input.value);
      paint(result);
      return result;
    },
    value: () => input.value,
    focus: () => input.focus(),
  };
}
