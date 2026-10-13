import { PageHeading } from "@/components/sports";
import { ChatAssistant } from "@/components/chat-assistant";
export const metadata = { title: "Asistente", robots: { index: false, follow: false } };
export default function AssistantPage() {
  return <>
    <PageHeading eyebrow="Club" title="Asistente" text="Pregunta por partidos, clasificaciones, actas y jugadores. Responde con los datos de la web; si no tiene un dato, te lo dirá."/>
    <ChatAssistant/>
  </>;
}
