# Asistente de chat con LLM local — Diseño

Fecha: 13/10/2026 · Estado: pendiente de revisión

## Objetivo

Una página `/asistente` en la web del club donde los jugadores con cuenta preguntan por datos del club (calendario, clasificación, ranking, actas, jugadores) y el entrenador, además, pide ayuda para preparar la jornada (disponibilidad, posiciones, parejas). El modelo corre en el PC con GPU de casa (el mismo donde vive el servidor de Laya), no en una API de pago.

**Fuera de alcance:** visión (fotos de actas), escribir datos desde el chat, guardar el historial en el servidor, respaldo con una API de pago, acceso de visitantes o anónimos.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Usos | A) datos del club para todos; B) asistente de alineaciones para el entrenador. |
| Modelo | `qwen3:8b` (Q4_K_M) en Ollama, solo texto, `num_ctx` 8192. Alternativa si no cabe en la VRAM: `qwen3:4b`. |
| Acceso | Cuentas `player` y `coach`. `visitor` y sin sesión, no. |
| PC apagado u ocupado | El chat se muestra «no disponible». Sin respaldo. |
| Red | Tailscale Funnel publica solo el puerto del chat (8766). El servidor de Laya (8765) sigue limitado a la LAN. |
| Datos al modelo | Tool calling desde Next.js; herramientas de solo lectura. |
| Interfaz | Página propia `/asistente`, no botón flotante (choca con `chip-stack` y `bottom-nav`). |
| Historial | Solo en el navegador (`sessionStorage`); se envían los últimos 10 mensajes. |

## Arquitectura

```
Navegador (/asistente)
   │  POST /api/chat (cookie de sesión)
   ▼
Render · Next.js /api/chat ── ejecuta herramientas ──▶ snp-service, season-ranking, …
   │  https + Bearer CHAT_LLM_KEY
   ▼
Tailscale Funnel (https://<pc>.<tailnet>.ts.net)
   ▼
PC · servidor_chat.py :8766 ──▶ Ollama 127.0.0.1:11434
          │
          └─ GET 127.0.0.1:8765/entrenamiento (servidor_laya.py)
```

## 1. Lado del PC (`Laya/pc_servidor/`, fuera de este repositorio)

### `servidor_chat.py` (nuevo)

FastAPI + uvicorn en `127.0.0.1:8766` (Funnel entra por localhost; no hace falta abrir el firewall). Mismo estilo que `servidor_laya.py`.

- **Clave:** `clave_chat.txt`, generada con `secrets.token_urlsafe(24)` la primera vez; distinta de `clave.txt`. Comparación con `hmac.compare_digest`. Se imprime al arrancar.
- `GET /salud` (sin clave): `{ ok, clave_ok, modelo, ollama: bool, laya_entrenando: bool }`. `ollama` = `GET 127.0.0.1:11434/api/tags` responde y contiene el modelo.
- `POST /chat` (con clave): cuerpo OpenAI `{ messages, tools?, stream? }`. Reenvía a `POST 127.0.0.1:11434/v1/chat/completions` con `model` fijado por el servidor (el cliente no elige modelo), `max_tokens` ≤ 1024, `options.num_ctx` 8192. Con `stream: true` devuelve el SSE de Ollama tal cual (`StreamingResponse`).
- **Límites:** ≤ 30 mensajes, ≤ 48 000 caracteres en total, ≤ 12 herramientas → 413/400.
- **Una petición a la vez:** `threading.Lock` sin bloqueo (`acquire(blocking=False)`); si está ocupado → 429 `{"detail": "ocupado"}`.
- **Coordinación con Laya:** antes de cada `/chat`, `GET 127.0.0.1:8765/entrenamiento` con la clave de `clave.txt` (si existe). Si `estado` es `preparando` o `entrenando` → 503 `"el PC está entrenando"`. Si Laya no está arrancado, se ignora.
- **Errores de Ollama:** conexión rechazada → 503 `"Ollama no está arrancado"`; timeout (120 s) → 504.

### Ollama

Variables de entorno de usuario en Windows: `OLLAMA_HOST=127.0.0.1:11434`, `OLLAMA_KEEP_ALIVE=10m` (descarga el modelo de la GPU tras 10 min sin uso y Laya recupera la memoria), `OLLAMA_NUM_PARALLEL=1`.

### Scripts y documentación

- `instalar_chat.bat`: comprueba `ollama` en el PATH (si no, indica la descarga), `ollama pull qwen3:8b`, `pip install httpx` en el `.venv` existente.
- `iniciar_chat.bat`: arranca `servidor_chat.py`, muestra la clave.
- `LEEME.txt`: sección «Asistente de chat»: instalar Ollama y Tailscale, `tailscale funnel --bg 8766`, copiar la URL `https://….ts.net` y la clave a Render (`CHAT_LLM_URL`, `CHAT_LLM_KEY`), pruebas con `curl`.

### Riesgo de VRAM

Laya mantiene sus modelos en la GPU. Si con ambos cargados `qwen3:8b` no cabe entero, Ollama reparte capas a la CPU (funciona, más lento). Se mide en la puesta en marcha (`ollama ps` muestra el % en GPU). Si < 100 % y la respuesta tarda > 20 s, opciones en orden: arrancar Laya con `--solo`, pasar a `qwen3:4b`.

## 2. Lado de la web

### Configuración

`CHAT_LLM_URL` y `CHAT_LLM_KEY` en `.env.example` (sección propia, solo servidor) y en `render.yaml` con `sync: false`. Sin ellas, el chat queda «no disponible» y nada más se rompe.

### `src/lib/chat/llm-client.ts`

- `chatHealth(): Promise<{ disponible: boolean; motivo?: string }>` → `GET {CHAT_LLM_URL}/salud`, timeout 4 s, con caché en memoria de 30 s.
- `chatCompletion(messages, tools, { stream })` → `POST {CHAT_LLM_URL}/chat` con Bearer. Timeout 120 s. Traduce 401/429/503/504/red a `ChatUnavailableError(motivo)` con texto en español para el usuario.

### `src/lib/chat/tools.ts`

Cada herramienta: definición JSON Schema (formato OpenAI `tools`) + ejecutor `(args, ctx) => Promise<object>`. Devuelven JSON recortado: nombres en vez de IDs, solo campos útiles, fechas en `Europe/Madrid`. Equipo como `"a" | "b"`.

| Herramienta | Rol | Fuente |
|---|---|---|
| `calendario(equipo)` | todos | calendario del equipo (mismo origen que `team-schedule`) |
| `clasificacion(equipo)` | todos | `getSnpCompetition` |
| `ranking_temporada(equipo)` | todos | `loadSeasonRanking` |
| `acta(equipo, jornada)` | todos | `getSnpMatch` |
| `jugador(nombre)` | todos | plantillas + `getSnpPlayer` + winrate (búsqueda por nombre sin tildes; si hay varios, devuelve la lista) |
| `disponibilidad(equipo, jornada?)` | coach | `savedAvailability` (por defecto la próxima jornada) |
| `posiciones_y_parejas(equipo)` | coach | `player-positions` + `saved-lineups` + winrates por pareja |

`toolsFor(role)` devuelve solo las permitidas; `runTool(name, args, role)` vuelve a comprobar el rol (si un jugador pide una herramienta de entrenador → error devuelto al modelo, no ejecución). Argumentos validados; resultado truncado a 6 000 caracteres.

### `src/lib/chat/conversation.ts`

`runConversation(history, role, user, llm)`, puro respecto a la red (recibe el cliente LLM por parámetro para poder probarlo):

1. Mensaje de sistema en español: asistente de la Escuela Fito Raya, fecha y hora actuales, nombre y rol del usuario, equipos A y B. Reglas: responder solo con datos obtenidos de herramientas; si no hay dato, decirlo; respuestas breves; no inventar resultados ni fechas. Se añade `/no_think` para desactivar el razonamiento de Qwen3 (más rápido).
2. Historial recortado a los últimos 10 mensajes `user`/`assistant`, cada uno ≤ 2 000 caracteres.
3. Bucle: llamada sin stream con `tools`; si devuelve `tool_calls`, ejecutar, añadir resultados, repetir. Máximo 4 vueltas; en la última se llama sin `tools` para forzar respuesta.
4. La respuesta final se pide con `stream: true` y se reenvía al navegador.

### `src/app/api/chat/route.ts` y `src/app/api/chat/estado/route.ts`

- `POST /api/chat`: `requireSameOrigin`; `currentAccount()`; rol `player` o `coach` (si no, 403). Límite de 20 mensajes por usuario y hora (mapa en memoria, mismo patrón que `limitAccountAttempts`) → 429. Responde un stream de texto con eventos NDJSON: `{"tipo":"herramienta","nombre":"clasificacion"}`, `{"tipo":"texto","delta":"…"}`, `{"tipo":"fin"}`, `{"tipo":"error","motivo":"…"}`. `Cache-Control: private, no-store`.
- `GET /api/chat/estado`: sesión obligatoria; devuelve `chatHealth()`.
- `proxy.ts` ya exige sesión en `/api/*` y redirige las páginas a `/acceso`; no hace falta excepción.

### Interfaz — `src/app/asistente/page.tsx` + `src/components/chat-assistant.tsx`

- Entrada «Asistente» (icono `MessageCircle`) en el menú lateral y en el menú del club en móvil; no en la `bottom-nav`.
- Lista de mensajes, caja de texto fija abajo, respuesta en streaming. Durante una herramienta, línea discreta «Consultando la clasificación…».
- Sugerencias iniciales por rol (jugador: próximo partido, ranking; entrenador: disponibles de la jornada, propuesta de parejas).
- Al cargar, `GET /api/chat/estado`; si no disponible, aviso «El asistente está desconectado ahora mismo» y caja desactivada, con botón «Reintentar». Error a mitad de respuesta → aviso dentro del mensaje.
- Markdown mínimo renderizado a mano (negrita, listas); nada de `dangerouslySetInnerHTML`.
- Historial en `sessionStorage` (envuelto en try/catch) y botón «Nueva conversación».
- Estilos con los tokens y clases de `globals.css`; sin librerías nuevas.

## 3. Pruebas

- `tests/chat-tools.test.ts`: `toolsFor("player")` no incluye herramientas de entrenador; `runTool` de una herramienta de entrenador con rol `player` no ejecuta; recorte de resultados; validación de argumentos.
- `tests/chat-conversation.test.ts` con un LLM falso: una vuelta sin herramientas; una vuelta con herramienta; tope de 4 vueltas; historial recortado; `ChatUnavailableError` → evento `error`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- PC: `curl` a `/salud` y `/chat` (documentado en `LEEME.txt`); comprobar 503 durante un entrenamiento de Laya y 429 con dos peticiones simultáneas.
- Extremo a extremo con el PC encendido: preguntas de jugador y de entrenador en `/asistente`; apagar `servidor_chat.py` y ver el aviso de desconectado.
