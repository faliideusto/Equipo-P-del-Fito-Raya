# Resultado del equipo para WhatsApp

## Activación

1. El propietario de Supabase ejecuta `supabase/team-captains.sql` en el SQL Editor. Es repetible. No hay variables nuevas en producción.
2. El entrenador elige en `/entrenador` → «Capitanes» un capitán para A y otro para B, entre los jugadores de la plantilla con cuenta.

Hasta que exista la tabla, la app funciona sin capitanes: solo el entrenador ve el mensaje.

## Flujo

Cuando las cinco parejas de una jornada tienen resultado (enviado en la app o con sets publicados en SNP; si hay ambos, manda la app), el capitán de ese equipo y el entrenador ven:

- Un aviso «Resultado del equipo · J4» en la esquina inferior derecha para la última jornada (la misma que usan los resultados pendientes). Se puede descartar; queda descartado en ese dispositivo.
- En la vista de la jornada, la tarjeta «Mensaje para WhatsApp» con la vista previa, «Enviar al grupo» y «Copiar».

«Enviar al grupo» abre WhatsApp con el texto escrito (`https://api.whatsapp.com/send?text=…`; no se usa `wa.me` porque su redirección cambia los emojis por «�»). La persona elige el grupo y pulsa enviar.

## Límites

La app no envía nada a WhatsApp por sí sola: no hay bot ni número propio, de acuerdo con los términos de WhatsApp. Los nombres de cada pareja salen de la convocatoria del acta SNP. Sin convocatoria, aparece el jugador que envió el resultado. Si el resultado cambia después, la tarjeta muestra el texto actualizado.

## Pruebas en local

`DEV_CAPTAIN_PLAYER_ID=<player_id>` en `.env.local` marca a ese jugador como capitán de los equipos en cuya plantilla está. Se ignora en producción, Render y Vercel.
