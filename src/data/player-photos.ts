// Fotos propias de los jugadores para las cartas y los avatares. Guarda la imagen en public/jugadores/
// y añade aquí el id SNP del jugador, por ejemplo: "320953": "/jugadores/320953.jpg".
// Si un jugador no aparece, se usa la foto publicada en SNP.
export const playerPhotos: Record<string, string> = {
  "248709": "/jugadores/248709.png", // José María García Muñoz
  "317975": "/jugadores/317975.png", // Ángel Afán Ortega
  "356418": "/jugadores/356418.png", // Jaime Castro Atienza
  "368641": "/jugadores/368641.png", // Daniel H. Campos Sánchez
  "368815": "/jugadores/368815.png", // Juan Antonio Romero Rodríguez
  "374686": "/jugadores/374686.png", // Manuel Cobos Galván
  "376502": "/jugadores/376502.png", // José Luis Narbona Sánchez
  "381423": "/jugadores/381423.png", // Rafael Deusto
  "388305": "/jugadores/388305.png", // José Manuel Borrego Bazán
  "397312": "/jugadores/397312.png", // Iván García
};

export function cardPhoto(player: { id: string; sourceId?: string; photoUrl?: string | null }) {
  return playerPhotos[player.sourceId ?? player.id] ?? player.photoUrl ?? null;
}
