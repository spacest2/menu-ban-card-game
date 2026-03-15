export type RoomStatus = "lobby" | "reveal_select" | "playing" | "finished";

export type ActionType =
  | "assassinate"
  | "attack5"
  | "attack3"
  | "attack2"
  | "heal5"
  | "heal3"
  | "heal2"
  | "revive";

export type TurnPhase = "awaiting_reveal_or_revive" | "action";

export interface ActionCardConfig {
  assassinate: number;
  attack5: number;
  attack3: number;
  attack2: number;
  heal5: number;
  heal3: number;
  heal2: number;
  revive: number;
}

export interface RoomRules {
  restaurantCardCountPerPlayer: number;
  actionCardConfig: ActionCardConfig;
}

export interface RestaurantCard {
  cardId: string;
  ownerPlayerId: string;
  ownerNickname: string;
  restaurantName: string;
  hp: number;
  baseHp: number;
  isDead: boolean;
  isRevealed: boolean;
  isInGraveyard: boolean;
}

export interface ActionCard {
  actionId: string;
  ownerPlayerId: string;
  type: ActionType;
  used: boolean;
}

export interface PlayerPublic {
  playerId: string;
  nickname: string;
  isReady: boolean;
  isHost: boolean;
  revealedCardId: string | null;
  remainingActionCardCount: number;
  hasSubmittedRestaurants: boolean;
  submittedRestaurantCount: number;
  aliveRevealedCardId: string | null;
  pendingRevealCard: RestaurantCard | null;
}

export interface PlayerPrivate {
  playerId: string;
  restaurantCards: RestaurantCard[];
  actionCards: ActionCard[];
  revealSelectionCardId: string | null;
}

export interface ActionLog {
  logId: string;
  actorPlayerId: string;
  actorNickname: string;
  actionType: ActionType | "system" | "reveal" | "end_turn";
  targetCardId: string | null;
  targetRestaurantName: string | null;
  targetOwnerNickname: string | null;
  value: number | null;
  message: string;
  timestamp: number;
}

export interface RoomDoc {
  roomId: string;
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  createdAt: number;
  updatedAt: number;
  version: number;
  rules: RoomRules;
  rulesDirty: boolean;
  playersCount: number;
  turnOrder: string[];
  currentTurnIndex: number;
  turnPhase: TurnPhase;
  cardsPlayedThisTurn: number;
  tableCards: RestaurantCard[];
  graveyardCards: RestaurantCard[];
  finalCandidates: RestaurantCard[];
}

export interface PublicRoomState {
  room: RoomDoc | null;
  players: PlayerPublic[];
  logs: ActionLog[];
  me: PlayerPrivate | null;
  myPlayerId: string | null;
}
