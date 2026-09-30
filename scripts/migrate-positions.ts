import { readFile } from "node:fs/promises";
import path from "node:path";
import { savePositions } from "../src/lib/player-positions";
async function migrate() {
  try { process.loadEnvFile(".env.local"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error("Configura Supabase antes de importar las posiciones.");
  const positions = JSON.parse(await readFile(path.resolve(process.env.PLAYER_POSITIONS_FILE || ".club-private/positions.json"), "utf8"));
  if (Object.entries(positions).some(([id, value]) => !/^[ab]-[a-z0-9-]+$/i.test(id) || ![null, "LEFT", "RIGHT", "BOTH"].includes(value as string | null))) throw new Error("Archivo de posiciones no válido.");
  await savePositions(positions);
  console.log(`Importadas ${Object.keys(positions).length} posiciones. El archivo local se conserva como copia.`);
}
migrate().catch(error => { console.error(error instanceof Error ? error.message : "No se pudieron importar las posiciones."); process.exitCode = 1; });
