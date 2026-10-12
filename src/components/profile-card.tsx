import { FifaCard } from "./fifa-card";
import { compactPoints, pointsTier, sideShort } from "@/domain/squad";
import type { PlayerCardData } from "@/lib/player-card";

export function ProfileCard({ card }: { card: PlayerCardData }) {
  return <div className="card-shadow profile-card-aside"><FifaCard name={card.name} photoUrl={card.photoUrl} rating={compactPoints(card.snpPoints)} ratingLabel={sideShort(card.position)} tier={pointsTier(card.snpPoints)}
    stats={[{ label: "RANK", value: card.snpRank ?? "—" }, { label: "PTS SNP", value: card.snpPoints === null ? "—" : Math.round(card.snpPoints).toLocaleString("es-ES") }]}/></div>;
}
