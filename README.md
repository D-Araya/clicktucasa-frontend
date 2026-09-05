# ClickTuCasa — Interfaz Web de Rifas de Casas (Frontend)

> Cliente tipado que consume el microservicio ClickTuCasa: catálogo, grilla de boletos, reserva, compra y sorteo.
> Proyecto Integrador — Programa Java Avanzado, Desafío Latam / Globant Talento Ready.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)
![Vite](https://img.shields.io/badge/Build-Vite-646CFF)
![Tailwind](https://img.shields.io/badge/CSS-Tailwind%204-38BDF8)
![any](https://img.shields.io/badge/any-cero-success)
![i18n](https://img.shields.io/badge/i18n-es%20%2F%20en-8B5CF6)

**Backend que consume esta app:** https://github.com/D-Araya/clicktucasa-api-springboot

---

## Stack Tecnológico

* **Backend:** Java 17, Spring Boot 3.3.4, Spring Data JPA, Hibernate, OpenAPI/Swagger.
* **Frontend:** TypeScript Vanilla (`strict: true`), Vite, Tailwind CSS 4, ESM nativo, HTML5/CSS3 semántico.
* **Infraestructura:** Docker Compose, PostgreSQL 16 Alpine.
* **Calidad y Testing:** `tsc` sin errores, cero `any` (incluidos los `catch`), cero aserciones `!`.
* **Internacionalización:** diccionarios `es` / `en` verificados por el compilador, formato de moneda, número y fecha por idioma.

---

## Repositorios de Referencia

* Core de Dominio / Hito 1: https://github.com/sebavidal10/neonpulse-ticketera
* Backend Spring Boot / Hito 4: https://github.com/sebavidal10/neonpulse-api-springboot
* Frontend Vite + TS / Hito 2: https://github.com/sebavidal10/neonpulse-frontend

---

## Guía de Puesta en Marcha Local

> El frontend **no funciona solo**: necesita el backend arriba. Los pasos 1 a 3 se ejecutan en el repositorio del backend.

### 1. Levantar la Base de Datos Relacional

    cd ClickTuCasa
    docker compose up -d

### 2. Ejecutar Pruebas Automatizadas

    ./mvnw clean test

### 3. Iniciar el Microservicio Backend

    ./mvnw spring-boot:run

* API REST: http://localhost:8080/api/v1/raffles
* Swagger UI (perfil `dev`): http://localhost:8080/swagger-ui.html

### 4. Iniciar la Interfaz Web Frontend

    cd ../click-tu-casa-frontend
    npm install
    npm run dev

* App Web: http://localhost:5173

---

## Datos de Prueba

La base arranca vacía y la app mostraría un catálogo vacío (estado que sí está contemplado en la interfaz). Para verla con contenido, ejecuta en el repositorio del backend:

    ./scripts/seed.sh          # Linux / macOS / Git Bash
    .\scripts\seed.ps1         # Windows PowerShell

Deja tres rifas, una de ellas con boletos vendidos y reservados.

---

## Variables de Entorno

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `VITE_API_URL` | URL base del microservicio backend, sin barra final | `http://localhost:8080` |

Copia `.env.example` a `.env` solo si tu backend corre en otro puerto:

    cp .env.example .env

`.env` está en `.gitignore`; `.env.example` se versiona a propósito, para documentar qué espera la aplicación.

---

## Cómo está organizado

```
src/
├── models/          Contrato tipado: interfaces, enums y value objects
│   ├── raffle.model.ts      RaffleBase, RaffleCatalogItem, Raffle, RaffleStatus
│   ├── ticket.model.ts      Ticket, TicketStatus, TicketPrice
│   └── requests.model.ts    DTOs de entrada/salida de la capa de servicio
├── services/        Consumo asíncrono de la API
│   ├── raffle.service.ts    Cliente HTTP: fetch, validación y mapeo
│   └── errors.ts            Excepciones de dominio, espejo de las del backend
├── components/      Componentes visuales, uno por carpeta
├── views/           Composición de pantallas
├── utils/           Formato, iconos y validación
├── i18n/            Diccionarios es/en y el motor de traducción
├── config/          app.config.ts — único lugar que conoce la URL de la API
└── main.ts          Controlador del DOM y orquestación de los cinco flujos
```

### El contrato con el backend

El modelo se parte en dos porque la API también lo hace:

| Tipo | Origen | Trae boletos |
|---|---|---|
| `RaffleCatalogItem` | `GET /api/v1/raffles` | No — solo los contadores |
| `Raffle` | `GET /api/v1/raffles/{id}` | Sí — la grilla completa |

Una rifa puede acuñar decenas de miles de boletos, así que el catálogo nunca los transfiere: la tarjeta se dibuja con `soldTickets`, `reservedTickets`, `availableTickets` y `totalTickets`, que el backend ya calcula.

Los enums son **literalmente** los del backend (`ACTIVE`/`DRAWN`/`CANCELLED`, `AVAILABLE`/`RESERVED`/`SOLD`). Estados de interfaz como "agotada" o "últimos boletos" se derivan de los contadores en `summarizeRaffle()`, nunca se agregan al enum.

Los campos de presentación (fotografía, ciudad, ficha técnica, certificación notarial) son **opcionales** en el modelo: el contrato actual del backend no los expone, así que la interfaz omite esos bloques en lugar de rellenarlos con textos genéricos. El día que la API los emita, aparecen solos.

### Cómo se consume la API

Cada respuesta pasa por dos fases, en este orden:

1. **Validación de canal** — `response.ok` *antes* de tocar el cuerpo. `fetch` no lanza ante un 404 ni un 500, solo ante un fallo de red; sin esa guarda un error del servidor se convertiría en un `undefined` que revienta durante el render.
2. **Validación de forma** — `response.json()` y luego lectura campo por campo con guardias de tipo. Nada entra al modelo sin comprobarse, y un enum desconocido lanza en vez de colarse.

Los errores llegan con el contrato `ErrorResponse` (`message`, `errorCode`, `timestamp`) del `GlobalExceptionHandler` y se reconstruyen como la excepción de dominio equivalente (`TicketNotAvailableError`, `PaymentFailedError`, …), de modo que la persona ve el mensaje real del backend y no un "algo salió mal".

Todos los `catch` usan `unknown`, nunca `any`.

---

## Gestión de idiomas (i18n)

La aplicación está disponible en **español e inglés**, con el selector `ES / EN` en la barra superior.

```
src/i18n/
├── translations.ts    Los dos diccionarios: 228 claves cada uno
└── index.ts           Idioma activo, t(), plural() y formato por idioma
```

Cuatro decisiones que vale la pena conocer:

**1. El diccionario español define el contrato, y el compilador lo vigila.**

```ts
export const es = { 'card.action.participate': 'Participar', /* ... */ } as const;
export type TranslationKey = keyof typeof es;
export const en: Record<TranslationKey, string> = { /* ... */ };
```

Si falta una traducción en inglés, o si alguien escribe `t('clave.inventada')`, **el proyecto no compila**. No existe la clave sin traducir que se descubre en producción.

**2. Nada de mapas constantes de etiquetas.** Un `Record<RaffleStatus, string>` a nivel de módulo se evalúa una sola vez, al importar el archivo, y se queda congelado en el idioma que hubiera entonces. Por eso las etiquetas son funciones: `raffleStatusLabel(status)`, `ticketStatusLabel(status)`, `paymentMethodLabel(method)`.

**3. El formato viaja con el idioma.** Traducir los textos y dejar los miles con separador chileno en inglés sería una localización a medias. `localeTag()` alimenta a `Intl` desde el mismo sitio que el diccionario:

| | `es` (`es-CL`) | `en` (`en-US`) |
|---|---|---|
| Moneda | `$185.000.000` | `CLP 185,000,000` |
| Miles | `14.200` | `14,200` |
| Fecha | `28 de noviembre de 2026` | `November 28, 2026` |
| Lista de folios | `#00001, #00002 y #00003` | `#00001, #00002 and #00003` |

El precio sigue siendo CLP en ambos idiomas: es un importe real y no se convierte, solo cambia cómo se escribe.

**4. Los plurales se eligen con dos claves explícitas**, no derivando `${key}.one` con una plantilla:

```ts
plural('cart.heading.one', 'cart.heading.other', count, { count: formatNumber(count) })
```

Así el compilador verifica que las dos formas existen — que es justo la garantía que se pierde con la magia de cadenas.

### Cómo se repinta

Sin framework reactivo, cambiar de idioma significa volver a dibujar lo que hay en pantalla. El selector solo llama a `setLocale()`; quien decide qué repintar es el suscriptor:

```ts
onLocaleChange(() => {
  view.refreshChrome();                                   // barra superior
  if (currentScreen.kind === 'detail') {
    view.renderRaffleDetail(currentScreen.raffle, ...);   // rifa abierta
    return;
  }
  renderList();                                           // catálogo
});
```

**No se dispara ni una petición de red:** el catálogo y la rifa abierta ya están en memoria, y el idioma solo cambia cómo se escriben, no lo que dicen los datos. La cesta, la página de la grilla y los filtros sobreviven al cambio.

`setLocale()` también actualiza `<html lang>`, el `<title>` y la `meta description`, que es lo que usan los lectores de pantalla y la pestaña del navegador.

### Cómo se elige el idioma inicial

Por orden de preferencia: lo que la persona eligió antes (`localStorage`), el idioma del navegador (`navigator.language`), y por último español. El acceso a `localStorage` está dentro de un `try`: en modo privado lanza en vez de devolver `null`, y eso no puede tumbar el arranque.

### Agregar un idioma

1. Añadir el código a `Locale` y a `SUPPORTED_LOCALES` en `src/i18n/index.ts`.
2. Añadir su etiqueta BCP-47 a `INTL_TAGS`.
3. Declarar el diccionario como `Record<TranslationKey, string>` — el compilador dirá exactamente qué falta.

---

## Verificación

    npm run build      # tsc + vite build, sin errores de tipos

Con el backend arriba, la consola del navegador debe quedar **sin un solo error**: ni de CORS, ni de red, ni de `undefined`.

---

## Historial del proyecto

* `docs/README_HITO2.md` — Unidad 2: la versión con datos simulados, previa a la integración.
* `docs/MEJORAS.md`, `docs/MEJORAS_2.md` — bitácora de refactorizaciones.
