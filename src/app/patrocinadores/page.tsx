import Image from "next/image";
import { ArrowUpRight, HeartHandshake } from "lucide-react";
import { PageHeading } from "@/components/sports";
import { sponsors } from "@/data/sponsors";
export default function SponsorsPage() {
  return <><PageHeading eyebrow="ESCUELA FITO RAYA · NUESTROS PATROCINADORES" title="También juegan con nosotros." text="Gracias a quienes apoyan al equipo dentro y fuera de la pista."/>
    <section className="sponsors-intro"><HeartHandshake size={28}/><div><h2>Un equipo, muchas manos.</h2><p>Conoce a las empresas que nos acompañan esta temporada.</p></div><span>{sponsors.length} patrocinadores</span></section>
    <div className="sponsors-grid">{sponsors.map(sponsor => { const Card = sponsor.href ? "a" : "article"; return <Card key={sponsor.id} {...(sponsor.href ? { href: sponsor.href, target: "_blank", rel: "noopener noreferrer", "aria-label": `${sponsor.name}: ${sponsor.action} (abre en otra pestaña)` } : {})} className={`sponsor-card sponsor-${sponsor.id}`}><div className="sponsor-logo"><Image src={`/sponsors/${sponsor.id}.png`} alt={`Logo de ${sponsor.name}`} fill sizes="(max-width: 700px) 85vw, (max-width: 1100px) 40vw, 28vw"/></div><div className="sponsor-content"><p className="eyebrow">{sponsor.category}</p><h2>{sponsor.name}</h2><p>{sponsor.description}</p>{sponsor.href && <span className="sponsor-action">{sponsor.action}<ArrowUpRight size={18}/></span>}</div></Card>; })}</div>
    <p className="data-note">Gracias por formar parte de Escuela Fito Raya. Usa los enlaces disponibles para conocer a los patrocinadores.</p>
  </>;
}
