# Puntos SNP

Fórmula deducida del historial de SNP (`ranking/ajaxGetByJugadorAndGrupo`) y comprobada el 11/10/2026 con las 9 actas jugadas de la 2ª y la 10ª: reproduce exactamente los 178 partidos-jugador y las 1.926 jornadas del historial.

## Puntos de un partido

`coeficiente de división × (resultado + bonus del enfrentamiento)`

| Resultado | Partido de 3 (parejas 1 y 2) | Partido de 2 (parejas 3 a 5) |
|---|---|---|
| Ganar 2-0 | 7 | 5 |
| Ganar 2-1 | 6 | 4 |
| Perder 1-2 | 4 | 2 |
| Perder 0-2 | 3 | 1 |

- Bonus: +1 si el equipo gana el enfrentamiento, +0,5 si empata.
- Coeficiente (solo fase regular): 1ª = 1, −0,05 por división hasta la 6ª (0,75), luego −0,01 por división (10ª = 0,71), mínimo 0,50.
- No influyen los puntos del compañero ni de los rivales, la posición en la pareja ni los juegos.

## Ranking

`100.000 × suma de puntos de la ventana / (8 × máx(4, partidos de la ventana))`

La ventana es el último año: al jugar la jornada N se cae la jornada N de la temporada anterior. En el historial SNP: `ptos_c` puntos de la jornada, `cr` coeficiente, `ptos_ca` suma de la ventana, `pda` partidos de la ventana, `ptos_md` = 8 × máx(4, pda), `puntos` ranking.

## En la web

`src/domain/snp-points.ts` calcula la previsión. El acta la muestra bajo cada pareja con los sets de SNP o, si aún no están, con el resultado provisional de la app. El bonus del equipo solo se suma cuando están los 5 partidos; antes se indica «+ bonus del equipo». Si un jugador juega ese fin de semana en dos divisiones, SNP suma los dos partidos.
