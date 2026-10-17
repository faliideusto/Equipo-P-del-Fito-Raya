"use client";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, SendHorizontal } from "lucide-react";
import { useIsCoach } from "./app-shell";
import { parseMarkdown, type Inline } from "@/lib/chat/markdown";
import { historyStore, teamChoice } from "@/lib/chat/history-store";
import type { ChatEvent, ChatHealth } from "@/lib/chat/types";

type Message = { role: "user" | "assistant"; content: string; error?: string };
const TOOL_LABELS: Record<string, string> = { calendario: "el calendario", clasificacion: "la clasificación", ranking_temporada: "el ranking de la temporada", acta: "el acta", jugador: "la ficha del jugador", disponibilidad: "los disponibles", posiciones_y_parejas: "posiciones y alineaciones" };
const SUGGESTIONS = {
  player: ["¿Cuándo jugamos el próximo partido?", "¿En qué puesto vamos en la clasificación?", "¿Quién tiene el mejor porcentaje de victorias?"],
  coach: ["¿Quién está disponible para la próxima jornada?", "Propón parejas para la próxima jornada", "¿Cómo quedó el acta de la última jornada?"],
};
const TEAMS: { value: "a" | "b" | null; label: string }[] = [{ value: "a", label: "Equipo A" }, { value: "b", label: "Equipo B" }, { value: null, label: "Ambos" }];

const fetchHealth = (): Promise<ChatHealth> => fetch("/api/chat/estado", { cache: "no-store" }).then(r => r.json() as Promise<ChatHealth>)
  .catch(() => ({ disponible: false, motivo: "No se pudo comprobar el asistente." }));

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
  const logRef = useRef<HTMLDivElement>(null);
  const [store] = useState(() => historyStore<Message>(() => sessionStorage));
  const [choice] = useState(() => teamChoice(() => sessionStorage));
  const [team, setTeam] = useState<"a" | "b" | null>(null);
  const pick = (value: "a" | "b" | null) => { setTeam(value); choice.save(value); };

  // State is only set from the fetch callback: react-hooks/set-state-in-effect rejects synchronous setState in effects.
  useEffect(() => { void fetchHealth().then(h => { setHealth(h); setMessages(store.load()); setTeam(choice.load(h.equipo ?? null)); }); }, [store, choice]);
  useEffect(() => {
    store.save(messages);
    // Scrolls the log only: scrollIntoView would also move the page.
    const log = logRef.current; if (log) log.scrollTop = log.scrollHeight;
  }, [messages, store]);
  const check = () => { setHealth(null); void fetchHealth().then(setHealth); };

  const update = (fn: (last: Message) => Message) => setMessages(list => [...list.slice(0, -1), fn(list[list.length - 1])]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending || !health?.disponible) return;
    const history = [...messages.filter(m => !m.error && m.content), { role: "user" as const, content: question }];
    setMessages([...messages, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setInput(""); setSending(true); setTool(null);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), equipo: team }) });
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
      <div className="chat-log" aria-live="polite" ref={logRef}>
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
      </div>
      {offline && <div className="chat-offline"><p>{health.motivo ?? "El asistente está desconectado ahora mismo."}</p><button type="button" className="button secondary small" onClick={check}>Reintentar</button></div>}
      <div className="chat-composer">
      <div className="chat-teams" role="radiogroup" aria-label="Equipo por el que preguntas">
        {TEAMS.map(t => <button key={t.label} type="button" role="radio" aria-checked={team === t.value} className={team === t.value ? "active" : ""} disabled={sending} onClick={() => pick(t.value)}>{t.label}</button>)}
      </div>
      <form className="chat-form" method="post" onSubmit={e => { e.preventDefault(); void send(input); }}>
        <button type="button" className="chat-reset" aria-label="Nueva conversación" title="Nueva conversación" disabled={sending || !messages.length} onClick={() => setMessages([])}><RotateCcw size={18}/></button>
        <input value={input} onChange={e => setInput(e.target.value)} maxLength={1000} placeholder={health === null ? "Comprobando el asistente…" : offline ? "Asistente no disponible" : "Escribe tu pregunta"} disabled={!health?.disponible || sending} aria-label="Pregunta para el asistente"/>
        <button type="submit" className="button small" disabled={!health?.disponible || sending || !input.trim()} aria-label="Enviar"><SendHorizontal size={18}/></button>
      </form>
      </div>
    </section>
  );
}
