"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { dueForCheck } from "@/domain/pending-results";
import type { TeamResultMessage } from "@/lib/team-result-service";
const DISMISSED_KEY = "fito-share-dismissed";
const keyOf = (m: TeamResultMessage) => `${m.fixtureId}:${m.teamId}`;
function dismissed(): string[] { try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"); } catch { return []; } }
function dismiss(key: string) { try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed().filter(k => k !== key), key].slice(-20))); } catch { /* Private mode: the chip may show again. */ } }
// Preview of the team message with WhatsApp share and copy; the person picks the group and sends it.
export function TeamResultCard({ message }: { message: TeamResultMessage }) {
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(message.text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } }
  return <section id="whatsapp" className="panel team-share"><div className="results-heading"><div><h2>Mensaje para WhatsApp</h2><p>Todas las parejas tienen resultado. Envíalo al grupo del equipo.</p></div></div><pre className="team-share-text">{message.text}</pre><div className="team-share-actions"><a className="button" href={message.url} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden/>Enviar al grupo</a><button type="button" className="button secondary" onClick={() => void copy()}>{copied ? "Copiado" : "Copiar"}</button></div></section>;
}
export function TeamResultChip() {
  const pathname = usePathname();
  const [items, setItems] = useState<TeamResultMessage[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const lastCheck = useRef<number | null>(null);
  useEffect(() => {
    if (!dueForCheck(lastCheck.current, Date.now())) return;
    const controller = new AbortController();
    void fetch("/api/results/share", { signal: controller.signal, cache: "no-store" }).then(r => r.ok ? r.json() : { items: [] }).then(data => { lastCheck.current = Date.now(); setHidden(dismissed()); setItems(Array.isArray(data.items) ? data.items : []); }).catch(() => {});
    return () => controller.abort();
  }, [pathname]);
  const current = items.find(m => !hidden.includes(keyOf(m)));
  if (!current) return null;
  return <div className="result-chip share-chip"><Link href={`/equipos/${current.teamId}/jornadas/${current.fixtureId}#whatsapp`}><MessageCircle size={16} aria-hidden/>Resultado del equipo · J{current.round}</Link><button type="button" aria-label="Descartar aviso" onClick={() => { dismiss(keyOf(current)); setHidden([...hidden, keyOf(current)]); }}><X size={14}/></button></div>;
}
