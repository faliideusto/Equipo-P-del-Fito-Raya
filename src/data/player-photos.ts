// Fotos propias de los jugadores para las cartas. Guarda la imagen en public/jugadores/
// y añade aquí el id SNP del jugador, por ejemplo: "320953": "/jugadores/320953.jpg".
// Si un jugador no aparece, se usa la foto publicada en SNP.
export const playerPhotos: Record<string, string> = {};

export function cardPhoto(player: { id: string; sourceId?: string; photoUrl?: string | null }) {
  return playerPhotos[player.sourceId ?? player.id] ?? player.photoUrl ?? null;
}
