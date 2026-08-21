import { renderIcon } from '../../utils/icon.utils';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastStyle {
  readonly border: string;
  readonly icon: string;
  readonly iconTone: string;
}

const TONE_STYLES: Record<ToastTone, ToastStyle> = {
  success: {
    border: 'border-emerald-500/50',
    icon: 'checkCircle',
    iconTone: 'text-emerald-400',
  },
  error: { border: 'border-rose-500/50', icon: 'alert', iconTone: 'text-rose-400' },
  info: { border: 'border-indigo-500/50', icon: 'info', iconTone: 'text-indigo-400' },
};

/**
 * Avisos flotantes de la aplicación.
 *
 * Un único contenedor fijo, creado una sola vez y reutilizado: cada aviso
 * se retira solo a los 5 segundos, o antes si la persona lo cierra.
 */
export class ToastHost {
  private readonly container: HTMLElement;

  constructor() {
    const existing = document.getElementById('toast-host');

    if (existing !== null) {
      this.container = existing;
      return;
    }

    const host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
    this.container = host;
  }

  show(title: string, message: string, tone: ToastTone = 'info'): void {
    const style = TONE_STYLES[tone];

    const toast = document.createElement('div');
    toast.className =
      `pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border ${style.border} ` +
      'bg-slate-900/95 backdrop-blur-md shadow-2xl animate-slide-in-right';

    const icon = document.createElement('span');
    icon.className = `${style.iconTone} shrink-0 mt-0.5`;
    icon.innerHTML = renderIcon(style.icon, 'w-4 h-4');

    const body = document.createElement('div');
    body.className = 'flex-1 min-w-0';

    const titleElement = document.createElement('p');
    titleElement.className = 'font-bold text-sm text-white';
    titleElement.textContent = title;

    const messageElement = document.createElement('p');
    messageElement.className = 'text-xs text-slate-300 mt-0.5 break-words';
    messageElement.textContent = message;

    body.append(titleElement, messageElement);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'shrink-0 text-slate-500 hover:text-slate-200 transition-colors cursor-pointer';
    closeButton.setAttribute('aria-label', 'Cerrar aviso');
    closeButton.innerHTML = renderIcon('close', 'w-4 h-4');

    const dismiss = (): void => {
      window.clearTimeout(timer);
      toast.remove();
    };

    closeButton.addEventListener('click', dismiss);
    const timer = window.setTimeout(dismiss, 5000);

    toast.append(icon, body, closeButton);
    this.container.appendChild(toast);
  }
}
