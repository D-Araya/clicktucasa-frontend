import { type RaffleCatalogItem, RaffleStatus, summarizeRaffle } from '../../models';
import { formatCurrencyCompact, formatNumber } from '../../utils/format.utils';
import { renderIcon } from '../../utils/icon.utils';
import { plural, t } from '../../i18n';

/**
 * Cabecera del catálogo: propuesta de valor, métricas agregadas del
 * portafolio y accesos rápidos por ciudad.
 */
export function createHeroBannerElement(
  raffles: readonly RaffleCatalogItem[],
  selectedCity: string,
  onSelectCity: (city: string) => void,
): HTMLElement {
  const activeRaffles = raffles.filter((raffle) => raffle.status === RaffleStatus.ACTIVE);

  const portfolioValue = activeRaffles.reduce((total, raffle) => total + raffle.houseValue.amount, 0);
  const soldTickets = activeRaffles.reduce(
    (total, raffle) => total + summarizeRaffle(raffle).soldCount,
    0,
  );
  // Las ciudades y la certificación notarial son datos de presentación que
  // el contrato actual del backend no expone: la cabecera se adapta a lo
  // que realmente llega en vez de mostrar métricas vacías.
  const cities = [...new Set(
    activeRaffles
      .map((raffle) => raffle.city)
      .filter((city): city is string => city !== undefined),
  )].sort((a, b) => a.localeCompare(b, 'es'));
  const certifiedCount = raffles.filter((raffle) => raffle.notary?.isVerified === true).length;
  const hasCertification = raffles.some((raffle) => raffle.notary !== undefined);

  const section = document.createElement('section');
  section.className =
    'relative overflow-hidden border-b border-slate-800/80 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950';

  section.innerHTML = `
    <div class="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12">
      <div class="flex flex-col lg:flex-row lg:items-center gap-10">
        <div class="flex-1 space-y-5 animate-slide-up">
          <span class="inline-flex items-center gap-2 text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-full">
            ${renderIcon('sparkles', 'w-3.5 h-3.5')}
            ${t('hero.badge')}
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          </span>

          <h1 class="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight font-display text-white">
            ${t('hero.titleLine1')}
            <span class="block bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
              ${t('hero.titleLine2')}
            </span>
          </h1>

          <p class="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
            ${t('hero.lead')}
          </p>

          <div id="hero-cities" class="flex flex-wrap gap-2 pt-1"></div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 lg:w-80">
          ${buildMetricCard(
            'building',
            t('hero.metric.portfolio'),
            formatCurrencyCompact(portfolioValue),
            plural('hero.metric.portfolioNote.one', 'hero.metric.portfolioNote.other', activeRaffles.length, {
              count: formatNumber(activeRaffles.length),
            }),
          )}
          ${hasCertification
            ? buildMetricCard(
                'shield',
                t('hero.metric.certification'),
                `${certifiedCount}/${raffles.length}`,
                t('hero.metric.certificationNote'),
              )
            : buildMetricCard(
                'building',
                t('hero.metric.published'),
                formatNumber(raffles.length),
                t('hero.metric.publishedNote'),
              )}
          ${buildMetricCard(
            'ticket',
            t('hero.metric.soldTickets'),
            formatNumber(soldTickets),
            t('hero.metric.soldTicketsNote'),
          )}
        </div>
      </div>
    </div>
  `;

  // ── Chips de ciudad ────────────────────────────────────────────
  const citiesContainer = section.querySelector<HTMLElement>('#hero-cities');

  // Sin ciudades en el contrato, la fila de chips sencillamente no se pinta.
  if (citiesContainer && cities.length > 0) {
    [t('hero.allCities'), ...cities].forEach((city) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      const isActive = city === selectedCity;
      chip.className = isActive
        ? 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105 transition-all cursor-pointer'
        : 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white transition-all cursor-pointer';
      chip.textContent = city;
      chip.addEventListener('click', () => onSelectCity(city));
      citiesContainer.appendChild(chip);
    });
  }

  return section;
}

function buildMetricCard(icon: string, label: string, value: string, note: string): string {
  return `
    <div class="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-sm">
      <div class="flex items-center gap-2 text-slate-400 mb-1.5">
        ${renderIcon(icon, 'w-3.5 h-3.5 text-indigo-400')}
        <span class="text-[10px] uppercase font-bold tracking-wider">${label}</span>
      </div>
      <p class="text-xl sm:text-2xl font-black text-white font-display font-mono">${value}</p>
      <p class="text-[11px] text-slate-500 mt-0.5">${note}</p>
    </div>
  `;
}
