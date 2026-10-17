# Resultados pendientes

## Activación

Ejecutar `supabase/match-results.sql` en el SQL Editor de Supabase. Es repetible. No hay variables nuevas.

## Flujo

Una hora después del inicio de la última jornada de A o B, la app consulta el acta SNP de ese enfrentamiento para cada jugador con cuenta:

- Si el jugador aparece con sets publicados, o la convocatoria no le incluye, no se le pide nada.
- Si está convocado sin sets, se le pide el resultado con su número de pareja fijado.
- Si el acta no tiene convocatoria, elige la pareja (1 a 5) o pulsa «No jugué».

El pop-up se abre una vez por jornada y dispositivo. Después queda un aviso en la esquina inferior derecha. Si un compañero ya registró la misma pareja, el pendiente desaparece. Sin pareja fijada, el jugador puede confirmar «Es mi partido».

El entrenador ve en `/entrenador` lo enviado en la última jornada y puede borrar un resultado para que se vuelva a pedir, también a quien lo confirmó con «Es mi partido».

## Navegación

El menú incluye «Última jornada», que abre la jornada ya empezada más reciente del equipo del jugador. Si está en A y en B, o es entrenador o visitante, abre la más reciente de los dos equipos. En la vista de una jornada hay enlaces a la jornada anterior y a la siguiente.

## Límites

La app no escribe en SNP: el capitán sigue completando el acta en SNP. Un fallo de SNP no crea avisos. Se reintenta al cambiar de sección. Los resultados se pueden modificar desde la vista de la jornada («Tu resultado en la app» → Modificar) mientras SNP no publique los sets de ese partido. Puede hacerlo quien lo envió, el compañero convocado en esa pareja o quien lo confirmó con «Es mi partido». El entrenador y el capitán de cada equipo pueden modificar el de cualquier pareja de su equipo desde la misma vista, también a partir de una hora después del inicio; se conserva quién lo envió. Además, el capitán puede usar «Añadir resultado» en las parejas sin resultado en la app, con el mismo plazo y siempre que SNP no haya publicado sus sets. El nuevo resultado queda registrado a nombre del capitán.

## Ranking y plantilla antes de que SNP cierre la jornada

Una hora después del inicio, mientras el calendario de SNP no tenga el marcador del enfrentamiento, la jornada se completa con lo que sabe la app (`src/lib/provisional-results.ts`): los sets de SNP si ya están y, si no, los resultados guardados en la app; los jugadores del acta si SNP ya los muestra y, si no, la convocatoria publicada (o, sin ella, quien envió el resultado).

- **Ranking de la temporada**: suma esos partidos y lo indica («provisional hasta que SNP publique el acta»).
- **Plantilla**: los jugadores de esa jornada muestran «PREVISIÓN», el ranking SNP calculado como en el acta (`docs/puntos-snp.md`). Necesita el historial SNP de cada jugador; si SNP no lo devuelve, se muestran los puntos publicados.

- **Resto de la web** (inicio, resumen del equipo, calendario, Wallet, asistente): la jornada cuenta como jugada, con un marcador provisional de los partidos ya decididos, en cuanto uno tiene ganador; el próximo partido pasa a ser el siguiente. Se aplica a jornadas de la última semana.

En cuanto SNP publica los jugadores de cada partido y el marcador, se usan solo sus datos.
