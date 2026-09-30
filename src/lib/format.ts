export const formatDate = (date: string) => !date || Number.isNaN(Date.parse(date)) ? "Fecha por confirmar" :
  new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  }).format(new Date(date));
export const formatTime = (date: string) =>
  !date.includes("T") || Number.isNaN(Date.parse(date))
    ? "Hora por confirmar"
    : new Intl.DateTimeFormat("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Madrid",
      }).format(new Date(date));
export const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
export const formatPoints = (points: number | null) =>
  points === null
    ? "Sin dato"
    : new Intl.NumberFormat("es-ES", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(points);
