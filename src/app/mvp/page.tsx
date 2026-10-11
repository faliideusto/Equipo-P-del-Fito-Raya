import { clubRepository } from "@/data/repository";
import { mvpAwards, type MvpAward } from "@/lib/mvp";
import { PageHeading } from "@/components/sports";
import { MvpBoard, type MvpCardStats } from "@/components/mvp-board";
import { loadSeasonRanking } from "@/lib/season-ranking-service";
import { rankingStats } from "@/components/season-ranking-cards";
import type { Player, TeamId } from "@/domain/types";

// Season contribution of every player, shown on the black IF card of the MVP.
async function cardStats(teamId: TeamId, players: Player[]): Promise<MvpCardStats> {
  try {
    const { rows } = await loadSeasonRanking(teamId, players);
    return Object.fromEntries(rows.map(row => [row.player.id, { points: row.points, stats: rankingStats(row) }]));
  } catch { return {}; }
}
export default async function MvpPage() {
  const [a, b] = await Promise.all([clubRepository.getPlayers("a"), clubRepository.getPlayers("b")]);
  const [statsA, statsB] = await Promise.all([cardStats("a", a), cardStats("b", b)]);
  let awards: MvpAward[] = []; let error = "";
  try { awards = await mvpAwards(); } catch { error = "Los MVP aún no están disponibles. Para activar este apartado, ejecuta supabase/mvp.sql en Supabase."; }
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const month = `${date.find(p => p.type === "year")!.value}-${date.find(p => p.type === "month")!.value}`;
  return <><PageHeading eyebrow="ESCUELA FITO RAYA · RECONOCIMIENTOS" title="MVP del mes." text="El entrenador elige al jugador más destacado de cada equipo."/><MvpBoard players={{ a, b }} initialAwards={awards} initialMonth={month} initialError={error} cardStats={{ a: statsA, b: statsB }}/></>;
}
