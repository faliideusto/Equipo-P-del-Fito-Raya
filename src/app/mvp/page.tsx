import { clubRepository } from "@/data/repository";
import { mvpAwards, type MvpAward } from "@/lib/mvp";
import { PageHeading } from "@/components/sports";
import { MvpBoard } from "@/components/mvp-board";
export default async function MvpPage() {
  const [a, b] = await Promise.all([clubRepository.getPlayers("a"), clubRepository.getPlayers("b")]);
  let awards: MvpAward[] = []; let error = "";
  try { awards = await mvpAwards(); } catch { error = "Los MVP aún no están disponibles. Para activar este apartado, ejecuta supabase/mvp.sql en Supabase."; }
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const month = `${date.find(p => p.type === "year")!.value}-${date.find(p => p.type === "month")!.value}`;
  return <><PageHeading eyebrow="ESCUELA FITO RAYA · RECONOCIMIENTOS" title="MVP del mes." text="El entrenador elige al jugador más destacado de cada equipo."/><MvpBoard players={{ a, b }} initialAwards={awards} initialMonth={month} initialError={error}/></>;
}
