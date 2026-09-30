import Link from "next/link";
export default function NotFound() {
  return (
    <div className="upcoming-note panel">
      <p className="eyebrow">FUERA DE PISTA · 404</p>
      <h1>No encontramos esta página.</h1>
      <p>Vuelve al inicio para consultar tus equipos.</p>
      <Link href="/" className="button">
        Volver al inicio
      </Link>
    </div>
  );
}
