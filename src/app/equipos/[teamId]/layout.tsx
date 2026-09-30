import { notFound } from "next/navigation";
import { ClubDataNote } from "@/components/club-data-note";
export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  if (teamId !== "a" && teamId !== "b") notFound();
  return <>{children}<ClubDataNote teamId={teamId}/></>;
}
