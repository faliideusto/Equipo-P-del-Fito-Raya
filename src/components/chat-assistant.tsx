"use client";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, SendHorizontal } from "lucide-react";
import { useIsCoach } from "./app-shell";
import { parseMarkdown, type Inline } from "@/lib/chat/markdown";
import type { ChatEvent, ChatHealth } from "@/lib/chat/types";

type Message = { role: "user" | "assistant"; content: string; error?: string };
const STORAGE = "fito-asistente";
const TOOL_LABELS: Record<string, string> = { calendario: "el calendario", clasificacion: "la clasificación", ranking_temporada: "el ranking de la temporada", acta: "el acta", jugador: "la ficha del jugador", disponibilidad: "los disponibles", posiciones_y_parejas: "posiciones y alineaciones" };
const SUGGESTIONS = {
  player: ["¿Cuándo jugamos el próximo partido del equipo A?", "¿En qué puesto va el equipo B en la clasificación?", "¿Quién lidera el ranking de la temporada del equipo A?"],
  coach: ["¿Quién está disponible para la próxima jornada del equipo A?", "Propón parejas para la próxima jornada del equipo B", "¿Cómo quedó el acta de la última jornada del equipo A?"],
};

function restored(): Message[] {
  try { const saved = JSON.parse(sessionStorage.getItem(STORAGE) ?? "[]"); return Array.isArray(saved) ? saved : []; } catch { return []; }
}

function Rich({ text }: { text: string }) {
  const parts = (inl: Inline[]) => inl.map((p, i) => p.bold ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>);
  return <>{parseMarkdown(text).map((b, i) => b.type === "p" ? <p key={i}>{parts(b.parts)}</p> : <ul key={i}>{b.items.map((it, j) => <li key={j}>{parts(it)}</li>)}</ul>)}</>;
}

export function ChatAssistant() {
  const coach = useIsCoach();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [health, setHealth] = useState<ChatHealth | null>(null);
  const [sending, setSending] = useState(false);
  const [tool, setTool] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // State is only set from the fetch callback: react-hooks/set-state-in-effect rejects synchronous setState in effects.
  const load = (restore: boolean) => fetch("/api/chat/estado", { cache: "no-store" }).then(r => r.json()).then((h: ChatHealth) => {
    setHealth(h);
    if (restore) setMessages(restored());
  }).catch(() => setHealth({ disponible: false, motivo: "No se pudo comprobar el asistente." }));
  useEffect(() => { void load(true); }, []);
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE, JSON.stringify(messages)); } catch { /* private mode */ }
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);
  const check = () => { setHealth(null); void load(false); };

  const update = (fn: (last: Message) => Message) => setMessages(list => [...list.slice(0, -1), fn(list[list.length - 1])]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending || !health?.disponible) return;
    const history = [...messages.filter(m => !m.error && m.content), { role: "user" as const, content: question }];
    setMessages([...messages, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setInput(""); setSending(true); setTool(null);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }) });
      if (!response.ok || !response.body) { const data = await response.json().catch(() => ({})); update(m => ({ ...m, error: data.error ?? "No se pudo enviar la pregunta." })); return; }
      const reader = response.body.getReader(); const decoder = new TextDecoder();
      let buffer = ""; let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event: ChatEvent = JSON.parse(line);
          if (event.tipo === "herramienta") setTool(TOOL_LABELS[event.nombre] ?? "los datos del club");
          else if (event.tipo === "texto") { setTool(null); update(m => ({ ...m, content: m.content + event.delta })); }
          else if (event.tipo === "error") { finished = true; update(m => ({ ...m, error: event.motivo })); }
          else finished = true;
        }
      }
      if (!finished) update(m => ({ ...m, error: "Se cortó la respuesta." }));
    } catch {
      update(m => ({ ...m, error: "Se perdió la conexión con el asistente." }));
    } finally { setSending(false); setTool(null); }
  }

  const offline = health && !health.disponible;
  return (
    <section className="panel chat-panel">
      <div className="chat-log" aria-live="polite">
        {!messages.length && <div className="chat-suggestions">
          <p>Pregunta por partidos, clasificaciones, actas o jugadores{coach ? ", o pide ayuda con las parejas" : ""}.</p>
          {SUGGESTIONS[coach ? "coach" : "player"].map(s => <button key={s} type="button" className="button secondary small" disabled={!health?.disponible} onClick={() => send(s)}>{s}</button>)}
        </div>}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            {m.role === "assistant" ? <Rich text={m.content}/> : <p>{m.content}</p>}
            {m.role === "assistant" && !m.content && !m.error && sending && i === messages.length - 1 && <p className="chat-status">{tool ? `Consultando ${tool}…` : "Pensando…"}</p>}
            {m.error && <p className="chat-error">{m.error}</p>}
          </div>
        ))}
        {sending && tool && messages.at(-1)?.content && <p className="chat-status">Consultando {tool}…</p>}
        <div ref={endRef}/>
      </div>
      {offline && <div className="chat-offline"><p>{health.motivo ?? "El asistente está desconectado ahora mismo."}</p><button type="button" className="button secondary small" onClick={check}>Reintentar</button></div>}
      <form className="chat-form" method="post" onSubmit={e => { e.preventDefault(); void send(input); }}>
        <button type="button" className="chat-reset" aria-label="Nueva conversación" title="Nueva conversación" disabled={sending || !messages.length} onClick={() => setMessages([])}><RotateCcw size={18}/></button>
        <input value={input} onChange={e => setInput(e.target.value)} maxLength={1000} placeholder={health === null ? "Comprobando el asistente…" : offline ? "Asistente no disponible" : "Escribe tu pregunta"} disabled={!health?.disponible || sending} aria-label="Pregunta para el asistente"/>
        <button type="submit" className="button small" disabled={!health?.disponible || sending || !input.trim()} aria-label="Enviar"><SendHorizontal size={18}/></button>
      </form>
    </section>
  );
}
