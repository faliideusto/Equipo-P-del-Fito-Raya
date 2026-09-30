const origin = process.env.APP_URL ?? "http://127.0.0.1:3000";
const routes = [
  "/",
  ...["a", "b"].flatMap((id) =>
    [
      "",
      "/clasificacion",
      "/plantilla",
      "/parejas",
      "/jornadas",
      ...{
        a: [
          "55252",
          "55262",
          "55266",
          "55272",
          "55280",
          "55253",
          "55263",
          "55267",
          "55273",
          "55281",
        ],
        b: [
          "55498",
          "55500",
          "55504",
          "55510",
          "55499",
          "55501",
          "55505",
          "55511",
        ],
      }[id].map((fixtureId) => "/jornadas/" + fixtureId),
    ].map((path) => `/equipos/${id}${path}`),
  ),
];
for (const route of routes) {
  const response = await fetch(new URL(route, origin));
  if (response.status !== 200) throw new Error(`${route}: ${response.status}`);
  const html = await response.text();
  if (!html.includes("Fito Raya"))
    throw new Error(`${route}: contenido ausente`);
}
for (const route of [
  "/equipos/c",
  "/equipos/a/jornadas/55498",
  "/equipos/b/jornadas/55252",
  "/equipos/a/jornadas/desconocida",
]) {
  const response = await fetch(new URL(route, origin));
  const html = await response.text();
  if (!html.includes("No encontramos esta página"))
    throw new Error(`${route}: falta la página 404`);
}
console.log(
  `${routes.length} rutas verificadas y 4 rutas inválidas muestran la página 404.`,
);
