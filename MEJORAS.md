# Áreas de mejora — ClickTuCasa Frontend

**Fecha del análisis:** agosto de 2026
**Alcance:** 23 archivos TypeScript (≈2.170 líneas), `index.html`, `style.css`, configuración y datos.
**Método:** auditoría de código línea por línea con verificación manual de cada hallazgo (ejecución del algoritmo o lectura del flujo completo).

Este documento existe a propósito, versionado junto al código: mostrar que se conocen las limitaciones propias — y con qué prioridad se atacarían — es tan parte de la entrega como el código mismo. El resumen ejecutivo y la tabla de prioridades a continuación son la versión corta; el resto del documento es la evidencia línea por línea.

---

## Resumen ejecutivo

El proyecto cumple sólidamente los tres pilares que evalúa la rúbrica del Hito 2: cero `any`, `strict: true`, `npm run build` en verde, `fetch` con validación de canal y forma, guardias de nulidad en el 100 % de los accesos al DOM, y cero aserciones `!`. Los puntos de esta lista **no bajan la nota del Hito 2** — no son fallas de esos tres pilares — pero sí son defectos reales de comportamiento y deuda técnica que conviene resolver antes de construir el Hito 3 sobre esta base.

| Prioridad | Tema | Impacto |
|---|---|---|
| **P1** | Cuatro defectos funcionales visibles al usuario | Alto |
| **P2** | Rendimiento: materialización de 90.000 objetos por carga | Medio-alto |
| **P3** | Accesibilidad: contraste y ARIA | Medio |
| **P4** | Calidad: duplicación, código muerto, sin tests | Medio |
| **P5** | UX y robustez | Bajo-medio |

---

## P1 · Defectos funcionales

### 1.1 🔴 Reservar un boleto lo vuelve incomprable

**Dónde:** `TicketGrid.ts:52`, `:175`, `:223`, `:376` contra `raffle.service.ts:218`

El servicio permite explícitamente comprar un boleto que uno mismo reservó:

```ts
if (ticket.status === TicketStatus.RESERVED && ticket.ownerId !== request.userId) {
  throw new TicketNotAvailableError(...);   // solo falla si es de OTRO usuario
}
```

Pero la interfaz lo impide por cuatro caminos a la vez: `toggleTicket` sale si el estado no es `AVAILABLE`, las celdas `RESERVED` van `disabled`, el buscador de folio deshabilita su botón, y el bloque de purga **borra de la cesta** todo lo que deje de estar disponible.

**Escenario:** seleccionas 3 boletos → "Reservar 3 boletos" → éxito → la vista se repinta → los 3 boletos (ahora `RESERVED`) desaparecen de la cesta → el formulario de compra queda vacío y deshabilitado. **No hay ninguna interacción que los recupere.**

El subtítulo del formulario promete *"Bloquea tus boletos unos minutos y completa la compra después"*, y eso hoy es imposible. `ReserveTicketUseCase` queda como un callejón sin salida.

**Corrección:** permitir seleccionar celdas con `status === RESERVED && ownerId === usuarioActual`, con estilo propio ("Reservado por ti"), y añadir un bloque *Mis reservas* con la cuenta atrás de `reservedUntil`. Requiere persistir la identidad de sesión — que ya viaja hasta `main.ts` como parámetro `userId` y allí **se descarta**.

### 1.2 🔴 La probabilidad mostrada está mal calculada

**Dónde:** `TicketGrid.ts:308`

```ts
const probability = ((selection.length / raffle.tickets.length) * 100).toFixed(4);
```

Divide entre los 15.000 boletos **emitidos**, pero `drawWinner()` sortea únicamente entre los **vendidos** (`raffle.service.ts:309-311`). La probabilidad real de quien compra *k* boletos es `k / (vendidos + k)`.

**Magnitud del error, con los datos actuales:**

| Rifa | Vendidos | Muestra | Real | Factor |
|---|---:|---:|---:|---:|
| `raffle-5` (Chicureo) | 3.400 | 0,0067 % | 0,0294 % | **4,4×** |
| `raffle-4` (Pucón) | 6.100 | 0,0067 % | 0,0164 % | 2,5× |
| `raffle-1` (Zapallar) | 14.200 | 0,0067 % | 0,0070 % | 1,05× |

Es una cifra de negocio que se muestra **justo antes de pagar**. La subestimación es mayor cuanto menos vendida está la rifa.

**Corrección:**
```ts
const soldCount = summarizeRaffle(raffle).soldCount;
const probability = ((selection.length / (soldCount + selection.length)) * 100).toFixed(4);
```

### 1.3 🟠 Las fechas se muestran un día antes

**Dónde:** `raffle.service.ts:87-94` + `utils/format.utils.ts`

`new Date("2026-11-28")` se interpreta como **medianoche UTC**; al formatear con `toLocaleDateString('es-CL')` se resta el desfase chileno. Verificado ejecutándolo:

```
2026-11-28 → "27 de noviembre de 2026"
2026-06-14 → "13 de junio de 2026"    ← fecha del acta del ganador
2026-10-05 → "4 de octubre de 2026"
```

Afecta a la tarjeta, la ficha y el acta notarial del ganador. Además `daysUntil()` puede decir *"Sorteo hoy"* durante las últimas horas del día anterior.

**Corrección:** parsear los componentes como fecha local.
```ts
const [y, m, d] = value.split('-').map(Number);
const parsed = new Date(y, m - 1, d);
```

### 1.4 🟠 El buscador del catálogo pierde el foco a mitad de palabra

**Dónde:** `RaffleFilters.ts:222-227` → `raffleBoard.view.ts:235`

El `input` dispara `onChange` a los 220 ms, y eso acaba en `content.replaceChildren(fragment)`, que destruye y reconstruye el panel de filtros **con el input que tiene el foco dentro**. El valor sobrevive; el foco y el cursor, no. Escribes "zapallar", haces una micropausa tras "zap", y las letras siguientes no llegan a ningún sitio. Se agrava con el `window.scrollTo({ behavior: 'smooth' })` que arrastra la página hacia arriba en cada tecleo.

**Corrección de fondo:** que `renderRaffleList` no reconstruya la barra de filtros; crearla una vez y repintar solo la zona de resultados.
**Parche inmediato:** tras el re-render, reenfocar y restaurar `selectionStart`.

### 1.5 🟡 Un timer de debounce huérfano deshace el filtro recién aplicado

**Dónde:** `RaffleFilters.ts:221-227`

El `setTimeout` captura el objeto `filters` del momento en que se creó el panel y nunca se cancela cuando el panel se destruye.

**Escenario:** escribes "san" en el buscador y, antes de 220 ms, pulsas la pestaña "Sorteadas". La pestaña se aplica; 220 ms después el timer huérfano ejecuta `onChange({ ...filtrosViejos, search: 'san' })` con `status: 'ALL'` y **deshace la pestaña que acabas de pulsar**.

**Corrección:** guardar el id del timer fuera y limpiarlo al construir el panel siguiente.

### 1.6 🟡 Condiciones de carrera

| Dónde | Escenario |
|---|---|
| `raffle.service.ts:503-517` | `getMutableRaffle` hace `get` → `await fetchRaffles()` → `set`. Dos operaciones concurrentes sobre una rifa aún no mutada atraviesan el `await` las dos y el segundo `set` **borra las mutaciones del primero**, sin error. Corrección: cachear la *promesa*, no el resultado (`Map<string, Promise<Raffle>>`, con el `set` antes del `await`). |
| `main.ts:65-86` | Ninguna navegación descarta respuestas obsoletas. Clic en la rifa A y enseguida en B: gana la que responda última. Corrección: contador de generación (`const mine = ++requestId; ... if (mine !== requestId) return;`). |
| `RaffleCard.ts:296` | Los botones "Participar" nunca se deshabilitan; dos clics lanzan dos cargas. |

*(Los botones de enviar de los tres formularios **sí** se deshabilitan antes del `await`: el doble envío está bien cubierto.)*

### 1.7 🟡 Contador negativo si una rifa `DRAWN` llega sin ganador válido

**Dónde:** `RaffleCard.ts:261`

La rama negativa imprime `minTicketsToDraw - soldCount` sin `Math.max(0, ...)`. Con una rifa `DRAWN` de 15.000 vendidos y `winner` malformado se lee *"Faltan -1.000 para el mínimo"*. `DrawWinnerPanel.ts:55` sí protege — la inconsistencia confirma que es un descuido.

---

## P2 · Rendimiento

Medido en Node 22 sobre escritorio; un móvil de gama media es 4-8× más lento.

```
materializeTickets ×6  (una carga de catálogo)   51,6 ms   90.000 objetos
cloneRaffle ×6                                    73,6 ms
getAllRaffles completo                          42-98 ms
heap tras un catálogo                           21-26 MB
```

| # | Dónde | Problema |
|---|---|---|
| 2.1 | `raffle.service.ts:509` | `getMutableRaffle` llama a `fetchRaffles()` **entero** (segundo `fetch` + 90.000 objetos) para quedarse con una sola rifa. Se paga en la primera escritura de cada rifa. |
| 2.2 | `RaffleFilters.ts:79-84` | `summarizeRaffle` **dentro del comparador de `sort`**: ~20-30 recorridos de 15.000 boletos para ordenar 6 elementos, y ocurre **en cada tecla** del buscador. Corrección: precomputar el resumen una vez por rifa antes de ordenar y pasarlo a las tarjetas y al hero (30 recorridos → 6). |
| 2.3 | `raffle.model.ts:119` | `canBeDrawn` usa `getTicketsByStatus`, que crea un array de 14.200 elementos solo para leer `.length`. Corrección: bucle contador con corte temprano. |
| 2.4 | `raffle.service.ts:275-282` | `runBatch` es secuencial **y clona la rifa entera en cada iteración**: comprar 10 boletos = 10 × 600 ms de latencia + 10 clones ≈ **6 segundos** con un botón que solo dice "Procesando pago…". Corrección: un solo `delay()` por lote y un solo clon al final. |

**Corrección de raíz (elimina 2.1–2.4 de golpe):** dejar de materializar 15.000 objetos. El estado real es *un precio, dos contadores y una lista corta de excepciones*: guardar `{ total, soldCount, reservedCount, overrides: Map<number, TicketStatus> }` y derivar el estado de un boleto con `statusOf(n)`. `summarizeRaffle` pasa a O(1), `findTicketOrThrow` a O(1), y la grilla —que ya pagina— genera bajo demanda solo los 200 boletos visibles.

**El bundle está bien** y no es un problema: 80,7 kB de JS (21,9 kB gzip) y 57 kB de CSS (9,3 kB gzip). No hay clases de Tailwind construidas dinámicamente, así que el JIT purga correctamente. El peso real está fuera: seis imágenes de Unsplash a `w=1200` (~1-1,5 MB) para tarjetas que se pintan a 400 px — conviene `srcset`.

---

## P3 · Accesibilidad

### 3.1 Contraste (calculado, no estimado)

| Combinación | Ratio | AA (4,5:1) | Alcance |
|---|---:|---|---|
| `text-slate-500` sobre `slate-950` | 4,24 | ❌ | ~25 apariciones |
| `text-slate-500` sobre `slate-900` | 3,75 | ❌ | dentro de tarjetas |
| `placeholder:text-slate-600` | 2,66 | ❌❌ | todos los formularios |
| celda VENDIDO (`slate-600` + `opacity-50`) | ≈1,47 | ❌❌❌ | grilla de boletos |
| `text-white` sobre `emerald-600` | 3,77 | ❌ | pestaña "Activas" |
| `text-white` sobre `amber-600` | 3,19 | ❌ | pestaña "Sorteadas" |
| `text-slate-400` sobre `slate-950` | 7,87 | ✅ | — |
| `text-white` sobre `indigo-600` | 6,29 | ✅ | — |

El problema dominante es `text-slate-500`: son **todas** las microetiquetas en versalitas ("VALOR TASADO", "EMITIDOS", "DISPONIBLES"), los subtítulos de los formularios, los hints y el pie — y casi todas están a `text-[10px]`/`text-[11px]`, o sea texto normal según WCAG, sin la exención de "texto grande".

**Corrección (una pasada de buscar y reemplazar):** `text-slate-500` → `text-slate-400` para texto; `placeholder:text-slate-600` → `placeholder:text-slate-400`; pestaña Activas → `bg-emerald-700`; pestaña Sorteadas → `bg-amber-500 text-slate-950`.

### 3.2 ARIA y navegación por teclado

| # | Dónde | Problema |
|---|---|---|
| A1 | `TicketGrid.ts:113,115` y `Navbar.ts:38` | Botones cuyo único texto es `hidden sm:inline`: **en móvil no tienen nombre accesible**. Un lector anuncia "botón". Corrección: `aria-label` fijo. |
| A2 | `TicketGrid.ts:109` | `role="list"` sobre un contenedor de `<button>`: ARIA inválido, se anuncia "lista con 0 elementos". Corrección: quitarlo. |
| A3 | `RaffleFilters.ts:168`, `HeroBanner.ts:72` | El estado activo de pestañas y chips se comunica **solo por color**. Corrección: `aria-pressed`. Una línea por componente. |
| A4 | `FormField.ts:59,103` | El `<p>` de error no tiene `id`, el input no tiene `aria-describedby` ni `aria-invalid`. El foco salta al campo malo, pero no se anuncia por qué. |
| A5 | `raffleBoard.view.ts:316` | El banner con `role="status"` se crea **ya con el texto dentro** y luego se inserta: las regiones live solo anuncian cambios sobre un contenedor preexistente, así que **ese aviso no se lee nunca**. |
| A6 | `TicketGrid.ts:109` | 200 paradas de tabulación antes de llegar al paginador. Corrección: patrón *grid* de ARIA con `tabindex="-1"` y flechas, o mover el paginador antes. |
| A7 | `FormField.ts:50` | `autocomplete = 'off'` en nombre, correo, RUT y teléfono: bloquea el autorrelleno, que es una ayuda de accesibilidad de primer orden. Faltan además `inputmode` y `name`. |
| A8 | `style.css:147` | `prefers-reduced-motion` cubre las animaciones propias pero **no** `animate-pulse`/`animate-spin`/`animate-ping` de Tailwind, ni las transiciones, ni los `scrollTo({behavior:'smooth'})`. |

### 3.3 Semántica

- Salto de nivel en el detalle: `h1` → `h2` ("Garantía notarial") → tres `h3` hermanos que no cuelgan de ningún `h2`.
- Ficha técnica y contadores son rejillas de `<div>` con pares etiqueta/valor: semánticamente son `<dl>/<dt>/<dd>`.
- Falta un *skip link* a `#contenido` y un `aria-label` en el `<nav>`.

---

## P4 · Calidad y mantenibilidad

### 4.1 Duplicación

`ReservationForm.ts` y `PurchaseForm.ts` son **≈85 % el mismo archivo**: idénticos en la construcción del contenedor, `showFeedback`, `clearFeedback`, la mecánica de `setSelection`, el envoltorio de envío con guardado/restauración de la etiqueta del botón y el handler de `submit`.

Dentro de cada uno, la escalera de validación son cuatro `if` clonados:

```ts
// en lugar de cuatro bloques idénticos:
const fields = [nameField, emailField, rutField, phoneField];
const results = fields.map((f) => f.validate());
const firstInvalid = fields[results.findIndex((r) => !r.isValid)];
if (firstInvalid) { firstInvalid.focus(); return; }
```

**Corrección:** extraer `components/TicketForm/` con `createTicketForm({ title, icon, subtitle, fields, submit })` y un helper `runSubmit(button, feedback, work)`. Los dos formularios quedarían en ~50 líneas cada uno.

También son la misma función tres veces: `buildStat` y `buildCounter` (`raffleBoard.view.ts`) y `buildSummaryCell` (`TicketGrid.ts`).

### 4.2 Componentes con demasiadas responsabilidades

| Archivo | Líneas | Qué mezcla |
|---|---:|---|
| `views/raffleBoard.view.ts` | 595 | enrutado, *shell* de la página, `buildPropertySheet` (132 líneas) y `buildNotaryBlock` (68) que son componentes de pleno derecho, y la tabla de secciones incrustada en un método. |
| `components/TicketGrid/TicketGrid.ts` | 541 | plantilla, paginación, cesta, azar, buscador de folio y tres helpers de presentación. |

**Corrección:** sacar `PropertySheet` y `NotaryBlock` a `components/`; separar `TicketCart` y `TicketSearch`.

### 4.3 Código muerto

- `icon.utils.ts`: `createIconElement` nunca se importa; los iconos `percent`, `dice`, `cursor` no se usan.
- `format.utils.ts`: `formatDateTime` nunca se usa.
- `raffle.model.ts`: `isSoldOut` y `minimumPercentage` se calculan en cada `summarizeRaffle` (× 20-40 por render) y **nadie los lee**.
- `style.css:11-18`: las ocho variables `--ctc-*` no se referencian en ningún sitio.
- `TicketGrid.ts:334`: la rama "Ingresa solo dígitos" es **inalcanzable** — el input es `type="number"`, así que `.value` devuelve `''` ante texto y el `return` anterior se dispara primero.
- `TicketGrid.ts:424-430`: bucle de repintado anulado por el `renderGrid()` de tres líneas después.
- `main.ts:157-160`: el `try/catch` del bootstrap es código muerto, porque `showRaffleList` ya captura todo internamente.
- El parámetro `userId` viaja desde los formularios hasta `main.ts` y allí se descarta: cañería a ninguna parte (es justo lo que necesita el punto 1.1).

`noUnusedLocals` no detecta exportaciones sin usar. Añadir `knip` o `ts-prune`.

### 4.4 Comentarios que no coinciden con el código

| Dónde | Dice | Realidad |
|---|---|---|
| `raffle.service.ts:114` | "implementación real y definitiva, no un arnés de pruebas" | El mismo archivo tiene `maybeFailNetwork()`, `processSimulatedPayment()` y tres `Math.random()`. |
| `raffle.model.ts:138` | "un solo recorrido: filtrar cuatro veces sería costoso" | Cierto ahí, pero 18 líneas más arriba `canBeDrawn` hace ese `filter` derrochador. |
| `TicketGrid.ts:121` | "declarados una sola vez" | Se asignan en un bucle en tiempo de ejecución. |
| `TicketGrid.ts:469` | "un único listener para las 200 celdas" | 200 es un valor de configuración; el comentario lo congela. |

### 4.5 Números mágicos fuera de `app.config.ts`

`220` (debounce del buscador) y `150` (debounce del folio) — dos valores distintos sin motivo; `5000` (vida del toast); `15 * 60_000` en el servicio, que duplica `DEFAULT_RESERVATION_MINUTES`; `80` (umbral de "últimos boletos"); `toFixed(4)`; y sobre todo **`padStart(5)`** en `formatTicketNumber`, que está acoplado a `TOTAL_TICKETS = 15.000` — si el Hito 4 emite 150.000, el ancho del folio se rompe solo. Derivarlo de `String(total).length`.

### 4.6 Sin pruebas automatizadas

No hay runner ni un solo test. Dos obstáculos previos de testabilidad: `Math.random()` se llama directamente en el servicio, y `APP_CONFIG` es `as const` (no se pueden poner las tasas de fallo a 0). **Corrección previa:** inyectar `random: () => number` y `now: () => Date`.

**Herramienta:** Vitest, que reutiliza `vite.config.ts` sin configuración extra.

**Orden por relación valor/esfuerzo:**

1. **`utils/validation.utils.ts`** — lógica pura y densa. ~30 casos: RUT con dígito `K` y con resto 11 → `0`, teléfono con y sin `+56`, correo con dos `@`, `validateIntegerInRange("12abc")`. Media hora, cubre el mayor riesgo.
2. **`models/raffle.model.ts`** — `summarizeRaffle` con `tickets: []`, `canBeDrawn` justo en el borde (la rifa 3 está exactamente en 14.000), `isEndingSoon` en 79/80/100 %.
3. **`services/raffle.service.ts`** — con `vi.stubGlobal('fetch', ...)`: payload que no es array, `houseValue` como string, `ticketPrice` negativo, `soldTickets > 15000`, `endDate` basura.
4. **`applyFilters` + `sortRaffles`** — puras y exportadas.
5. **DOM con `@testing-library/dom`** — la página nunca sale de rango, la cesta se poda, `quickPick(10)` con 3 disponibles selecciona 3 sin fallar.

Falta además ESLint + Prettier con `@typescript-eslint/no-floating-promises` (hoy los `void promesa` están puestos a mano uno por uno).

---

## P5 · UX y robustez

### 5.1 Interfaz

| # | Dónde | Problema |
|---|---|---|
| 5.1.1 | `raffleBoard.view.ts:241` | `showDetailLoading` **no pinta el botón "Volver"**, y la navbar está deshabilitada por `setLoading(true)`: durante la carga no hay salida. |
| 5.1.2 | `RaffleCard.ts:21` vs `:90` | Dos porcentajes contradictorios en la misma tarjeta: la barra usa `vendidos/mínimo` (101 %, recortado a 100, aparece **llena**) y a tres centímetros el badge dice "95 % vendido" (`vendidos/total`). Además el comentario promete una marca del mínimo notarial sobre la barra que **no se dibuja**. |
| 5.1.3 | `main.ts:90` | "Volver al catálogo" vuelve a llamar a `getAllRaffles()`: 600 ms de espera y un 8 % de acabar en pantalla de error **al pulsar atrás**. El catálogo ya está en memoria; debería ser `renderList()`. |
| 5.1.4 | `raffleBoard.view.ts:283` | Tras cada operación se recrean los formularios: nombre, RUT, teléfono, medio de pago y aceptación de bases se pierden. Con un 25 % de rechazo por boleto, comprar 10 tiene un **5,6 %** de salir limpio: el camino normal es el parcial, y ahí hay que retipear todo. |
| 5.1.5 | `main.ts:129` | El resultado parcial enumera los folios fallidos **como texto**, sin acción. Debería ofrecer "Reintentar estos N boletos". |
| 5.1.6 | `TicketGrid.ts:110` | Sin boletos disponibles, los botones +1/+5/+10 y el paginador siguen habilitados; `quickPick` hace `return` en silencio. Un clic sin respuesta se lee como avería. |
| 5.1.7 | `app.config.ts:30` | El fallo de red al 8 % está activo siempre: ~1 de cada 12 cargas termina en error sin indicar que es simulado. Sugerencia: `import.meta.env.DEV ? 0.08 : 0` o un interruptor visible. |
| 5.1.8 | formularios | Los mensajes de progreso ("Contactando la pasarela de pago…") se pintan **en verde** (tono `success`) antes de saber el resultado. Falta un tono neutro. |
| 5.1.9 | — | **Sin `history.pushState`**: no se puede compartir el enlace de una rifa, recargar devuelve al catálogo, y el botón atrás del navegador **saca de la aplicación**. ~15 líneas y es la mejora de UX con mejor relación coste/beneficio. |
| 5.1.10 | `raffles.json` | No hay ninguna rifa `CANCELLED`: esa pestaña y esa sección nunca muestran nada. Deshabilitar pestañas con recuento 0 y mostrar el contador. |
| 5.1.11 | `PurchaseForm.ts:264` | Se paga sin confirmación. Un diálogo con el desglose es lo mínimo para una operación con dinero. |

### 5.2 Móvil

Tres regiones de scroll anidadas en el detalle (página, grilla `max-h-80`, chips de la cesta `max-h-24`): arrastrar sobre la grilla atrapa el gesto. Áreas táctiles por debajo de 44 px en +1/+5/+10, limpiar búsqueda, cerrar aviso y chips. 42 apariciones de `text-[10px]`/`text-[11px]`.

### 5.3 Robustez de los datos

| # | Dónde | Qué pasa |
|---|---|---|
| 5.3.1 | `raffle.service.ts:390` | Los value objects **nunca pueden lanzar**, porque reciben el `fallback` del lector. Si el JSON trae `"houseValue": "185000000"` (string), la casa se muestra tasada en **$1** y nadie se entera. Fallar en silencio con un dato absurdo es peor que fallar. |
| 5.3.2 | `raffle.service.ts:364` | En cambio un `ticketPrice` negativo sí revienta `createTicketPrice`, y como el `throw` ocurre dentro del `map`, **una rifa mal formada tumba el catálogo entero**. Incoherencia: unos campos degradan y otros abortan. Corrección: `try/catch` por rifa, descartar la mala y avisar ("1 de 6 propiedades no pudo cargarse"). |
| 5.3.3 | `raffle.service.ts:374` | `soldTickets` no se trunca a entero: un `9500.5` produce cortes fraccionarios en la materialización. |
| 5.3.4 | `raffle.service.ts:397` | `imageUrl` con fallback `''` hace que `img.src = ''` apunte al propio documento, se descargue entero y dispare `error` — funciona **por accidente**. |
| 5.3.5 | `raffle.service.ts:350` | `fetch` sin `AbortController` ni timeout. Sin red, el usuario lee *"Failed to fetch"* en inglés. Corrección: detectar `TypeError` y relanzar un error de dominio en español + `AbortSignal.timeout(10_000)`. |
| 5.3.6 | `index.html:14` | El `<link>` de Google Fonts es *render-blocking* desde un tercer dominio: sin red hay que esperar el timeout antes de pintar. Corrección: autoalojar con `@fontsource`, o carga no bloqueante. Además se piden **14 pesos** y se usan 6. |
| 5.3.7 | `index.html:20` | Sin `<noscript>`: con JS deshabilitado, página en blanco sin explicación. |

---

## Lo que está bien resuelto

Para no confundirlo con lo anterior, esto **no** hay que tocarlo:

1. **Cero `any` verificable por grep**, `strict: true` completo, `tsc && vite build` verde. Verificado, no declarado.
2. **El desempaquetado asíncrono en dos fases** (`raffle.service.ts:349-365`) es el mejor fragmento del proyecto: `response.ok` → `throw` con status y statusText → `json(): unknown` → `Array.isArray` → mapeo campo por campo.
3. **La frontera de datos externos** con `isRecord`/`readString`/`readNumber`/`readOptionalDate`, sin un solo `as` sobre el payload, incluidos los objetos anidados.
4. **Cero aserciones `!` y cero accesos al DOM sin guardia** en todo el proyecto.
5. **`textContent` para datos, `innerHTML` solo para andamiaje** en 39 de 41 usos.
6. **Módulo 11 real para el RUT**, con autoformateo y preservación del cursor.
7. **Delegación de eventos y repintado quirúrgico** en la grilla: un listener para 200 celdas, y al seleccionar se repinta una sola.
8. **`TicketGridState` fuera del componente** para que la cesta sobreviva a los re-renders.
9. **`BatchTicketResult` con éxitos y fallos separados**: modela el problema real en vez de "todo o nada". Es la decisión de diseño más madura del proyecto.
10. **La paginación nunca queda fuera de rango** (re-clamp tras recalcular los visibles).
11. **Arquitectura en capas respetada de verdad** con 23 archivos y sin framework.
12. **`error` handler en las imágenes** con degradado de reserva.
13. **Bundle correcto**: sin clases de Tailwind dinámicas, el JIT purga bien.

---

## Orden de ataque sugerido

**Media hora, alto impacto visible:**
2. Probabilidad (1.2) y fechas (1.3) — dos funciones.
3. Contraste (3.1) — buscar y reemplazar `slate-500` → `slate-400`.
4. `Math.max(0, ...)` en el contador (1.7) y `aria-label` en los botones sin texto (A1).

**Una tarde:**
5. Conectar reserva → compra (1.1), que es el defecto conceptualmente más grave.
6. Preservar formularios y ofrecer reintentar los fallidos (5.1.4, 5.1.5).
7. Precomputar `summarizeRaffle` antes de ordenar (2.2).
8. `history.pushState` (5.1.9).

**Si hay más tiempo:**
9. Vitest sobre validaciones y mapeo (4.6).
10. Extraer `TicketForm` común (4.1).
11. Sustituir la materialización por estado derivado (P2, corrección de raíz).
