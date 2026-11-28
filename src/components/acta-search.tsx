"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanSearch } from "lucide-react";
import { actaIdFrom } from "@/domain/acta-id";

// Straight to an acta by its number or its SNP link, without looking for the match.
export function ActaSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  return <form method="post" className="panel lineup-check-search" onSubmit={event => {
    event.preventDefault();
    const id = actaIdFrom(value);
    setError(!id);
    if (id) router.push(`/comprobar-alineaciones/${id}`);
  }}>
    <label htmlFor="acta">¿Tienes el acta? Pega el número o el enlace de SNP</label>
    <div>
      <input id="acta" value={value} onChange={event => { setValue(event.target.value); setError(false); }} inputMode="url" placeholder="54705 o …/enfrentamiento/edit/54705/verG" autoComplete="off"/>
      <button type="submit" className="button"><ScanSearch size={16}/> Comprobar</button>
    </div>
    {error && <p className="snp-warning" role="status">No reconozco ese acta. Pega solo el número o el enlace del encuentro.</p>}
  </form>;
}
