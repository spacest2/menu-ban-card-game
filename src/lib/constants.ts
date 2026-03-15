import { ActionCardConfig, RoomRules } from "../types/game";

export const ACTION_LABELS: Record<keyof ActionCardConfig, string> = {
  assassinate: "암살",
  attack5: "공격 5",
  attack3: "공격 3",
  attack2: "공격 2",
  heal5: "회복 5",
  heal3: "회복 3",
  heal2: "회복 2",
  revive: "부활"
};

export const ACTION_VALUES: Record<string, number> = {
  attack5: 5,
  attack3: 3,
  attack2: 2,
  heal5: 5,
  heal3: 3,
  heal2: 2,
  assassinate: 999,
  revive: 5
};

export const DEFAULT_RULES: RoomRules = {
  restaurantCardCountPerPlayer: 3,
  actionCardConfig: {
    assassinate: 2,
    attack5: 2,
    attack3: 2,
    attack2: 2,
    heal5: 2,
    heal3: 2,
    heal2: 2,
    revive: 1
  }
};

export const MAX_ACTIONS_PER_TURN = 3;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const BASE_RESTAURANT_HP = 10;
