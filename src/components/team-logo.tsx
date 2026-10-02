import Image from "next/image";

const logos: Record<string, string> = {
  CD_PADEL_ARCOS: "/team-logos/padel-arcos.png",
  "REBELIÓN 3K": "/team-logos/rebelion-3k.png",
  "GLOBALPADEL CANDELA": "/team-logos/global-padel.png",
  "TOP BAL PÁDEL GAME B": "/team-logos/top-bal.jpg",
};

export function TeamLogo({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  const source = name.toUpperCase().includes("FITO RAYA")
    ? "/logo-fito.png"
    : logos[name.trim().replace(/\s+/g, " ").toUpperCase()];
  return (
    <span className={`team-logo ${large ? "team-logo-large" : ""}`}>
      {source ? (
        <Image src={source} alt={`Logo de ${name}`} width={80} height={80} />
      ) : (
        <span aria-hidden="true">
          {name
            .split(/[\s_-]+/)
            .map((word) => word[0])
            .slice(0, 2)
            .join("")}
        </span>
      )}
    </span>
  );
}
