# Resultado del equipo para WhatsApp — Diseño

Fecha: 11/10/2026 · Estado: pendiente de revisión

## Objetivo

Cuando las cinco parejas de una jornada tienen resultado, la app prepara el mensaje del resultado completo del equipo con la plantilla del club. El capitán (o el entrenador) lo envía al grupo de WhatsApp con un toque. La app **no envía nada a WhatsApp**: abre el enlace de compartir con el texto ya escrito y la persona elige el grupo y pulsa enviar. Así se cumplen los términos de WhatsApp y no hacen falta número, servidor ni librerías extra.

**Fuera de alcance:** envío automático, bots, WhatsApp Business API, notificaciones por email o push, y pedir el compañero al registrar el resultado.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Envío | Lo hace una persona con `https://api.whatsapp.com/send?text=<mensaje>` (no `wa.me`: estropea los emojis) o con «Copiar». |
| Quién | El capitán del equipo y el entrenador. El resto no ve el mensaje y la API responde 403. |
| Capitán | Lo elige el entrenador en `/entrenador`, uno por equipo, en la tabla `team_captains`. |
| Completa | Las 5 parejas con resultado en la app o con sets publicados en el acta SNP. Si hay ambos, manda la app. |
| Jornada | La misma que usan los resultados pendientes: la última del equipo, 1 h después del inicio (`lastPlayedFixture`). También se puede generar desde la vista de cualquier jornada completa. |
| Aviso | Aviso fijo para capitán o entrenador cuando la última jornada está completa. Se descarta por jornada y dispositivo (`localStorage`). |

## Plantilla

Formato de WhatsApp (`*negrita*`). Ejemplo:

```
🎾 *Jornada 4 · Fito Raya A*
🆚 C.D. VibraPadel · 🏠 Local
📅 Sáb 18/10 · 17:00

🏆 *¡VICTORIA 8–4!*

*Pareja 1* (3 pts) ✅
Carlos Martín / Javi López
6-3 · 6-4

… (parejas 2 a 5)

💪 ¡Vamos Fito Raya!
```

- Línea 2: `🏠 Local` o `✈️ Visitante`. Línea 3: fecha y hora en Europe/Madrid. Si no hay hora, solo la fecha.
- Marcador: suma de `MATCH_VALUES[i]` de las parejas ganadas frente a las perdidas. `🏆 *¡VICTORIA x–y!*`, `😔 *DERROTA x–y*` o `🤝 *EMPATE x–y*`, siempre con nuestro marcador primero.
- Pareja: el ganador se calcula con los sets, desde nuestro lado. Lleva ✅ o ❌. Los sets se escriben `a-b` separados por ` · `, con nuestro marcador primero.
- Nombres: de la convocatoria del acta SNP (lado propio). Si no hay convocatoria, el nombre del jugador que envió el resultado (`player_id` → plantilla). Si no se conoce, la línea de nombres se omite.

## 1. Dominio — `src/domain/team-result-message.ts` (puro)

- `teamResultPairs(input)`: recibe los resultados de la app (`pair_index → sets` desde nuestro lado), el acta SNP (o `null`) y el lado propio (0 o 1). Devuelve 5 parejas `{ index, sets, names }` o `null` si falta alguna. Los sets SNP vienen como local–visitante y se giran cuando el lado propio es el visitante.
- `buildTeamResultMessage({ round, teamId, opponent, home, date, pairs })` devuelve el texto.
- `whatsappShareUrl(text)` devuelve `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`.

## 2. Capitanes — `supabase/team-captains.sql` y `src/lib/team-captains.ts`

```sql
create table if not exists public.team_captains (
  team_id text primary key check (team_id in ('a', 'b')),
  player_id text not null check (player_id ~ '^[0-9]{1,10}$'),
  updated_at timestamptz not null default now()
);
-- RLS activado, sin acceso para anon/authenticated, solo service_role.
```

- `listCaptains()` y `setCaptain(teamId, playerId | null)`, con el mismo patrón REST o archivo local que `mvp.ts`. Si la tabla no existe (`PGRST205` / `42P01`), `listCaptains` devuelve `[]` para que la app siga funcionando hasta que el propietario ejecute el SQL.
- `isTeamCaptain`: compara con la tabla. (La variable de desarrollo `DEV_CAPTAIN_PLAYER_ID` se usó para las pruebas y se retiró antes de la PR.)
- `canShareTeamResult(user, teamId)`: el entrenador siempre puede; un jugador con ficha vinculada, solo si es capitán.

## 3. Servicio y API

`src/lib/team-result-service.ts`:
- `teamResultMessage(teamId, fixture)` carga a la vez los resultados de la app, el acta SNP y la plantilla. Devuelve `{ fixtureId, round, text, url }` o `null` si la jornada no está completa.
- `shareableResults(user)` recorre los equipos que la persona puede compartir y devuelve los mensajes de la última jornada completa de cada uno.

`GET /api/results/share`: sin sesión → 401. Sin permiso → `{ items: [] }`, para que el aviso no aparezca. Con permiso → `{ items }`.

`POST /api/captains` (solo entrenador, mismo origen): `{ teamId, playerId | null }`. `GET /api/captains` (solo entrenador) devuelve los capitanes actuales y, por equipo, los candidatos: jugadores de la plantilla con cuenta vinculada.

## 4. Interfaz

- **Vista de la jornada** (`/equipos/[teamId]/jornadas/[fixtureId]`): si `canShareTeamResult` y la jornada está completa, se muestra la tarjeta «Mensaje para WhatsApp» bajo el acta, con la vista previa del texto (`<pre>`), el botón «Enviar al grupo» (enlace `api.whatsapp.com/send`, nueva pestaña) y el botón «Copiar» (Clipboard API, con el mensaje «Copiado»).
- **Aviso** `TeamResultShare`: componente cliente junto a `ResultReminder`. Consulta `/api/results/share` con la misma cadencia (`dueForCheck`). Muestra el chip «Resultado del equipo · J4» que enlaza a la jornada. Tiene un botón para descartarlo, guardado por `fixtureId:teamId` en `localStorage`.
- **`/entrenador`**: sección «Capitanes» con un `<select>` por equipo (vacío = sin capitán). Si la tabla no existe, muestra la indicación de ejecutar `supabase/team-captains.sql`.

## 5. Errores

- SNP no disponible: solo cuentan los resultados de la app. Si están las 5 parejas, el mensaje se genera sin los nombres de la convocatoria.
- Supabase no disponible al leer capitanes: sin permiso para jugadores. El entrenador sigue pudiendo.
- El texto se genera siempre en el servidor. El cliente no puede alterar los datos del mensaje.

## 6. Pruebas

- `tests/team-result-message.test.ts`: victoria, derrota y empate, tercer set, giro de sets SNP cuando somos visitantes, prioridad de la app sobre SNP, jornada incompleta → `null`, nombres sin convocatoria, fecha sin hora y codificación de la URL.
- `tests/team-captains.test.ts`: el capitán guardado solo lo es de su equipo.
- Comprobación manual en local: botón de WhatsApp, Ver texto, Copiar y aviso.

## Activación

1. El propietario ejecuta `supabase/team-captains.sql` en Supabase.
2. El entrenador elige los capitanes en `/entrenador`.
3. No hay variables nuevas en producción.
