import { playerAttributeStore } from "./player-attribute-store";

// Keyed by SNP player id: the same person keeps the nickname in both teams.
const store = playerAttributeStore<string>({ table: "player_nicknames", column: "nickname", fileEnv: "PLAYER_NICKNAMES_FILE", defaultFile: ".club-private/nicknames.json", label: "motes" });
export const readNicknames = store.read;
export const saveNicknames = store.save;
