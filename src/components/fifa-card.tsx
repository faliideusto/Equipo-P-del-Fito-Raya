"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { initials } from "@/lib/format";

export type CardStat = { label: string; value: string | number };
export type CardTier = "gold" | "silver" | "bronze" | "if";

export function FifaCard({ name, photoUrl, rating, ratingLabel, badge, stats, tier = "gold", href, size = "normal" }: {
  name: string; photoUrl: string | null; rating: string; ratingLabel: string; badge?: string; stats: CardStat[];
  tier?: CardTier; href?: string; size?: "normal" | "large";
}) {
  const [failed, setFailed] = useState(false);
  const shortName = name.split(" ").length > 2 ? name.split(" ").slice(0, 2).join(" ") : name;
  const body = <>
    <span className="fifa-card-rating"><b>{rating}</b><small>{ratingLabel}</small>{badge && <em>{badge}</em>}</span>
    {tier === "if" && <span className="fifa-card-tag">IF</span>}
    <span className="fifa-card-photo">{photoUrl && !failed ? <Image src={photoUrl} alt="" width={160} height={160} unoptimized onError={() => setFailed(true)}/> : <span aria-hidden="true">{initials(name)}</span>}</span>
    <strong className="fifa-card-name">{shortName}</strong>
    <span className="fifa-card-stats">{stats.map(stat => <span key={stat.label}><b>{stat.value}</b>{stat.label}</span>)}</span>
  </>;
  const className = `fifa-card fifa-${tier} fifa-${size}${rating.length > 3 ? " fifa-long-rating" : ""}`;
  const label = `${name}. ${rating} ${ratingLabel}. ${stats.map(s => `${s.label} ${s.value}`).join(", ")}`;
  return href ? <Link className={className} href={href} aria-label={label}>{body}</Link> : <div className={className} role="img" aria-label={label}>{body}</div>;
}
