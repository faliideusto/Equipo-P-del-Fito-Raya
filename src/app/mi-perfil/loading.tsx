import { PageHeading } from "@/components/sports";
import { MyProfileSkeleton } from "@/components/skeletons";
// Same heading and skeleton the page shows while it loads, so nothing jumps.
export default function Loading() {
  return <><PageHeading eyebrow="TU ESPACIO EN EL CLUB" title="Mi perfil." text="Tu jugador y lo que aportas a tu equipo."/><MyProfileSkeleton/></>;
}
