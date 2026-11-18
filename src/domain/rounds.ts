// SNP numbers the challenge match ("retos") as round 1000, but it is played between
// the first phase (rounds 1–5) and the second (6–10). Sort rounds by when they are played.
export const CHALLENGE_ROUND = 1000;
export const roundOrder = (round: number) => round === CHALLENGE_ROUND ? 5.5 : round;
export const byRound = (a: { round: number }, b: { round: number }) => roundOrder(a.round) - roundOrder(b.round);
