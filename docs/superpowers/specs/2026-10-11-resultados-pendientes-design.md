# Resultados pendientes tras la jornada — Diseño

Fecha: 11/10/2026 · Estado: pendiente de revisión

## Objetivo

Que cada jugador con cuenta registre el resultado de su partido en la última jornada SNP de su equipo cuando SNP todavía no lo ha publicado. La app detecta la jornada, comprueba si ya hay resultado (en SNP o en la app) y, si falta, abre un pop-up. Si el jugador lo cierra, queda un aviso fijo en una esquina hasta que lo resuelva.

**Fuera de alcance:** escribir en SNP. La integración sigue siendo de solo lectura (`docs/integracion-snp.md`). Lo guardado en la app es un registro del club que el capitán o el entrenador usa para completar el acta en SNP.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Destino del resultado | Solo la app (Supabase). Se consulta SNP para no pedir lo que ya está publicado. |
| Saber si jugó | Acta SNP (la convocatoria es obligatoria antes del partido). Respaldo: botón «No jugué». |
| Datos del formulario | Número de pareja (1–5) y cuadrante de 3 sets. Sin compañero ni rivales. |
| Pareja | Fijada y no editable si el acta tiene al usuario convocado; selector libre si no. |
| Jornada | Solo la última del equipo, a partir de 2 h después de la hora de inicio. |
| Edición | No editable en v1; el entrenador puede borrar para que se vuelva a pedir. |
| Repetición del pop-up | Una vez por jornada y dispositivo; después solo el chip de la esquina. |

## 1. Detección — `GET /api/results/pending`

Solo para cuentas `player` con ficha vinculada (`playerLink`). Entrenador, visitante o cuenta sin ficha → `{ pending: [] }`. Sin sesión → 401, como el resto de APIs.

Para cada equipo del club (`a`, `b`) en cuya plantilla está el `player_id` del usuario (puede estar en los dos):

1. **Última jornada:** del calendario del equipo (mismo origen que `team-schedule`), el último partido en el que juega ese equipo y cuya `date + 2 h <= ahora`. Si no hay fecha o no existe, no hay pendiente.
2. **Acta SNP** (`getSnpMatch(fixture.id)`), identificando el lado propio con `teamIds`:
   - El usuario aparece en un partido **con sets** → resuelto por SNP.
   - Hay alineación (algún partido con jugadores propios) y **el usuario no aparece** → no jugó.
   - El usuario aparece **sin sets** → pendiente, `pairLocked = índice + 1`.
   - El acta no tiene alineación propia → pendiente, `pairLocked = null`.
3. **Datos de la app:**
   - Existe `match_absences(user_id, fixture_id)` → sin aviso.
   - `pairLocked` conocido y existe `match_results(fixture_id, team_id, pair_index)` → sin aviso (lo envió el compañero).
   - `pairLocked = null` y el usuario ya envió un resultado para ese `fixture_id` y equipo → sin aviso.

Si SNP falla o el acta solo llega de la caché o captura con `stale: true` sin alineación, no se crea pendiente. Se reintentará en la siguiente comprobación.

Respuesta:

```ts
type PendingResult = {
  fixtureId: string; teamId: TeamId; round: number; date: string;
  opponent: string; home: boolean; pairLocked: number | null;
};
```

**Riesgo que hay que verificar primero:** `parseMatch` solo se ha probado con actas ya jugadas. Hay que obtener un acta en estado «convocado, sin sets», comprobar que devuelve los jugadores con `sets: []` y que el orden de `games` corresponde a pareja 1…5. Si no es así, se ajusta el parser con un test basado en ese HTML (sin datos privados).

## 2. Envío — `POST /api/results`

Cuerpo: `{ action: "result", fixtureId, teamId, pairIndex, sets }` o `{ action: "absent", fixtureId, teamId }`.

El servidor:
- Valida sesión, origen y tamaño, y limita intentos (como `account`).
- Recalcula el pendiente. Si la jornada ya no está pendiente para ese usuario, responde 409.
- Si `pairLocked` existe, usa ese valor e ignora `pairIndex`.
- Valida los sets (`src/domain/match-result.ts`, función pura con tests):
  - Set 1 y set 2 obligatorios. Un set válido es 6–0…6–4, 7–5 o 7–6 para cualquiera de los dos lados.
  - Si los dos primeros los gana el mismo lado, el set 3 debe estar vacío.
  - Si van 1–1, el set 3 es obligatorio: un set válido o un súper tie-break (ganador ≥ 10 y diferencia de 2; si el ganador pasa de 10, la diferencia es exactamente 2).
  - Los sets se guardan como `[nosotros, rivales]`.
- Si la clave única de `match_results` choca → 409 «Este resultado ya lo ha registrado otro jugador».

`DELETE /api/results` (solo entrenador): `{ fixtureId, teamId, pairIndex }`.
`GET /api/results?scope=coach` (solo entrenador): resultados de la última jornada de A y B.

## 3. Almacenamiento

`supabase/match-results.sql`:

```sql
create table if not exists public.match_results (
  fixture_id text not null check (fixture_id ~ '^[0-9]{1,10}$'),
  team_id text not null check (team_id in ('a','b')),
  pair_index smallint not null check (pair_index between 1 and 5),
  sets jsonb not null,
  player_id text not null,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (fixture_id, team_id, pair_index)
);
create table if not exists public.match_absences (
  user_id uuid not null references auth.users(id) on delete cascade,
  fixture_id text not null check (fixture_id ~ '^[0-9]{1,10}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, fixture_id)
);
-- RLS activada; revoke a anon/authenticated; permisos solo a service_role.
```

`src/lib/match-results.ts` sigue el patrón de `mvp.ts` y `saved-lineups.ts`: REST de Supabase con `SUPABASE_URL` y `SUPABASE_SECRET_KEY`, y archivos `.club-private/match-results.json` y `match-absences.json` en desarrollo, con escritura atómica y cola `pending`. En Render o Vercel sin Supabase, error explícito.

## 4. Pantalla

**`src/components/result-reminder.tsx`** (cliente), montado en `AppShell` fuera de `/acceso`. Consulta `/api/results/pending` al montar y al cambiar de ruta. Si falla, no muestra nada.

- **Pop-up (modal):** cabecera «Jornada N · Fito A vs Rival · fecha».
  - Selector de pareja 1–5. Si `pairLocked`, aparece bloqueado con un candado y «según acta SNP».
  - Cuadrante de 2 filas (Nosotros / Rivales) × 3 columnas (Set 1, 2, 3) con campos numéricos. El set 3 se desactiva y vacía cuando los sets 1 y 2 dan ganador. Validación en vivo con el mismo módulo de dominio.
  - Botones: **Guardar resultado**, **No jugué** y ✕.
  - Accesible: `role="dialog"`, foco atrapado, Escape cierra.
- **Chip de pendiente:** al cerrar, botón fijo en la esquina inferior derecha, «Resultado pendiente · JN», con el estilo de aviso del tema. Reabre el pop-up. En móvil queda por encima de la navegación. Con varios pendientes (A y B) muestra el número y el pop-up los resuelve uno a uno.
- **Una vez por jornada:** `localStorage["fito-result-seen"]` guarda los `fixtureId` ya mostrados (lectura y escritura en try/catch). Si ya se vio, solo aparece el chip.
- Al guardar o marcar «No jugué», se vuelve a consultar el pendiente y el chip desaparece.

**Entrenador** (`coach-dashboard.tsx`): sección «Resultados enviados» con la última jornada de A y B: pareja, sets, jugador que lo envió y botón Borrar.

## 5. Pruebas

- `tests/match-result.test.ts`: validación de sets (válidos, inválidos, tercer set vacío u obligatorio, súper tie-break).
- `tests/pending-results.test.ts`: lógica de detección como función pura con calendario, acta y datos de la app simulados. Cubre cada rama de la sección 1, el margen de 2 h y el jugador compartido A/B.
- Parser: test con el HTML de un acta convocada sin sets.
- Se ejecutan `pnpm test`, `pnpm lint`, `pnpm typecheck` y `pnpm build`, y se prueba manualmente en la app (pop-up, chip, guardado y panel del entrenador).

## 6. Documentación

Añadir a `docs/cuentas.md` o a un `docs/resultados.md` nuevo: SQL que hay que ejecutar, flujo y limitación (no se escribe en SNP).
