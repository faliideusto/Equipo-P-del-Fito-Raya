import type {
  Fixture,
  Player,
  Position,
  Standing,
  Team,
  TeamId,
} from "@/domain/types";
export const teams: Team[] = [
  {
    id: "a",
    name: "Escuela Fito Raya A",
    shortName: "Equipo A",
    division: "Segunda División Future",
  },
  {
    id: "b",
    name: "Escuela Fito Raya B",
    shortName: "Equipo B",
    division: "Décima División Future",
  },
];
const names = {
  a: [
    "Rafael Romero",
    "Pablo García",
    "Álvaro Ruiz",
    "Juan Moreno",
    "Mario Sánchez",
    "Carlos Medina",
    "Pedro Navarro",
    "Javier Ortega",
    "Daniel Pérez",
    "Sergio López",
    "Miguel Santos",
    "Fran Jiménez",
    "Antonio Vega",
    "David Torres",
  ],
  b: [
    "Manuel Reyes",
    "José Castillo",
    "Adrián Molina",
    "Diego Ramos",
    "Rubén Herrera",
    "Luis Márquez",
    "Jesús Gil",
    "Víctor León",
    "Iván Cortés",
    "Hugo Domínguez",
    "Óscar Núñez",
    "Andrés Soto",
    "Enrique Ríos",
    "Marcos Vidal",
  ],
};
const positions: Position[] = [
  "RIGHT",
  "LEFT",
  "BOTH",
  "LEFT",
  "RIGHT",
  "BOTH",
  "RIGHT",
  "LEFT",
  "BOTH",
  "LEFT",
  "RIGHT",
  "LEFT",
  "BOTH",
  "RIGHT",
];
const points = {
  a: [810, 745, 680, 620, 570, 525, 480, 430, 395, 350, 310, 265, 220, 175],
  b: [420, 385, 340, 310, 280, 250, 225, 195, 170, 145, 120, 95, 75, 50],
};
export const players: Player[] = teams.flatMap((team) =>
  names[team.id].map((name, i) => ({
    id: `${team.id}-${i + 1}`,
    name,
    teamId: team.id,
    points: points[team.id][i],
    position: positions[i],
  })),
);
export const standings: Record<TeamId, Standing[]> = {
  a: [
    { name: "La Cañada Pádel", played: 3, won: 3, lost: 0, points: 28 },
    { name: teams[0].name, played: 3, won: 2, lost: 1, points: 22, own: true },
    { name: "Club Pádel Jerez", played: 3, won: 2, lost: 1, points: 21 },
    { name: "Las Marías", played: 3, won: 1, lost: 2, points: 15 },
    { name: "Pádel Puerto Real", played: 3, won: 1, lost: 2, points: 13 },
    { name: "Sherry Pádel", played: 3, won: 0, lost: 3, points: 8 },
  ],
  b: [
    { name: "Pádel Bahía", played: 3, won: 3, lost: 0, points: 27 },
    { name: "Los Olivos", played: 3, won: 2, lost: 1, points: 24 },
    { name: teams[1].name, played: 3, won: 2, lost: 1, points: 22, own: true },
    { name: "Pádel Sanlúcar", played: 3, won: 1, lost: 2, points: 15 },
    { name: "Costa Pádel", played: 3, won: 1, lost: 2, points: 12 },
    { name: "Club La Janda", played: 3, won: 0, lost: 3, points: 8 },
  ],
};
const rivals = {
  a: [
    "Sherry Pádel",
    "Las Marías",
    "Pádel Puerto Real",
    "Club Pádel Jerez",
    "La Cañada Pádel",
    "Sherry Pádel",
  ],
  b: [
    "Costa Pádel",
    "Club La Janda",
    "Pádel Sanlúcar",
    "Los Olivos",
    "Pádel Bahía",
    "Costa Pádel",
  ],
};
const dates = [
  "2026-09-06T10:00:00+02:00",
  "2026-09-13T10:00:00+02:00",
  "2026-09-20T10:00:00+02:00",
  "2026-10-04T10:00:00+02:00",
  "2026-10-18T10:00:00+02:00",
  "2026-11-01T10:00:00+01:00",
];
export const fixtures: Fixture[] = teams.flatMap((team) =>
  dates.map((date, i) => {
    const home = i % 2 === 1;
    const wins =
      i === 0
        ? [true, true, true, true, false]
        : i === 1
          ? [true, false, true, false, true]
          : [false, true, false, true, false];
    return {
      id: `${team.id}-j${i + 1}`,
      teamId: team.id,
      round: i + 1,
      opponent: rivals[team.id][i],
      date,
      home,
      venue: home ? "Pádel Game Xerez" : "Club del equipo rival",
      status: i < 3 ? "played" : "pending",
      matches:
        i < 3
          ? Array.from({ length: 5 }, (_, j) => ({
              pairIndex: j,
              playerIds: [
                `${team.id}-${j * 2 + 1}`,
                `${team.id}-${j * 2 + 2}`,
              ] as [string, string],
              opponents: [
                `Jugador rival ${j * 2 + 1}`,
                `Jugador rival ${j * 2 + 2}`,
              ] as [string, string],
              winner: (wins[j] === home ? "home" : "away") as "home" | "away",
            }))
          : [],
    };
  }),
);
