import { notFound } from "next/navigation";
import { canSeeCayitos } from "@/lib/cayitos";
// The check runs here, above loading.tsx: anyone else gets the 404 straight away, without even
// seeing the skeleton of a private section.
export default async function CayitosLayout({ children }: { children: React.ReactNode }) {
  if (!(await canSeeCayitos())) notFound();
  return children;
}
