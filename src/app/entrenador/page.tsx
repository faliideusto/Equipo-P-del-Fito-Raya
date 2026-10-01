import { redirect } from "next/navigation";
import { isCoachSession } from "@/lib/coach-session";
import { CoachDashboard } from "@/components/coach-dashboard";
export const metadata = { title: "Panel del entrenador", robots: { index: false, follow: false } };
export default async function CoachPage() { if (!await isCoachSession()) redirect("/mi-perfil"); return <CoachDashboard/>; }
