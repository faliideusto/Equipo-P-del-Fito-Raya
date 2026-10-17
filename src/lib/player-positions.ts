import type { Position } from "@/domain/types";
import { hasPersistentPlayerData, playerAttributeStore } from "./player-attribute-store";

const store = playerAttributeStore<Position>({ table: "player_positions", column: "position", fileEnv: "PLAYER_POSITIONS_FILE", defaultFile: ".club-private/positions.json", label: "posiciones" });
export const hasPersistentPositions = hasPersistentPlayerData;
export const readPositions = store.read;
export const savePositions = store.save;
