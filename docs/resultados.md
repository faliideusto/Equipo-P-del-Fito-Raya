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

La app no escribe en SNP: el capitán sigue completando el acta en SNP. Un fallo de SNP no crea avisos. Se reintenta al cambiar de sección. Los resultados se pueden modificar desde la vista de la jornada («Tu resultado en la app» → Modificar) mientras SNP no publique los sets de ese partido. Puede hacerlo quien lo envió, el compañero convocado en esa pareja o quien lo confirmó con «Es mi partido». El entrenador y el capitán de cada equipo pueden modificar el de cualquier pareja de su equipo desde la misma vista, también a partir de una hora después del inicio; se conserva quién lo envió.
