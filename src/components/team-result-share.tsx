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
const WHATSAPP_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";
// WhatsApp share button; the text preview and copy stay folded until asked for.
export function TeamResultCard({ message }: { message: TeamResultMessage }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(message.text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } }
  return <section id="whatsapp" className="team-share">
    <div className="team-share-bar"><a className="whatsapp-button" href={message.url} target="_blank" rel="noopener noreferrer" aria-label="Enviar el resultado al grupo de WhatsApp" title="Enviar al grupo de WhatsApp"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path fill="currentColor" d={WHATSAPP_PATH}/></svg></a><span>Resultado del equipo listo para el grupo</span><button type="button" className="text-link" aria-expanded={open} aria-controls="whatsapp-text" onClick={() => setOpen(!open)}>{open ? "Ocultar texto" : "Ver texto"}</button></div>
    {open && <div id="whatsapp-text" className="team-share-body"><pre className="team-share-text">{message.text}</pre><button type="button" className="button secondary" onClick={() => void copy()}>{copied ? "Copiado" : "Copiar"}</button></div>}
  </section>;
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
