import { DEFAULT_RULES } from "./constants";
import { ActionCardConfig, RoomRules } from "../types/game";

const ACTION_KEYS = Object.keys(DEFAULT_RULES.actionCardConfig) as Array<
  keyof ActionCardConfig
>;

export function totalActionCards(config: ActionCardConfig) {
  return ACTION_KEYS.reduce((sum, key) => sum + config[key], 0);
}

export function normalizeRules(input: RoomRules): RoomRules {
  const nextConfig = { ...DEFAULT_RULES.actionCardConfig };

  for (const key of ACTION_KEYS) {
    const rawValue = Number(input.actionCardConfig[key]);
    nextConfig[key] = Number.isInteger(rawValue) ? rawValue : DEFAULT_RULES.actionCardConfig[key];
  }

  return {
    restaurantCardCountPerPlayer: Number.isInteger(input.restaurantCardCountPerPlayer)
      ? input.restaurantCardCountPerPlayer
      : DEFAULT_RULES.restaurantCardCountPerPlayer,
    actionCardConfig: nextConfig
  };
}

export function validateRules(rules: RoomRules) {
  const normalized = normalizeRules(rules);
  const errors: string[] = [];

  if (
    normalized.restaurantCardCountPerPlayer < 1 ||
    normalized.restaurantCardCountPerPlayer > 5
  ) {
    errors.push("식당 카드 수는 1~5 사이여야 합니다.");
  }

  for (const key of ACTION_KEYS) {
    if (normalized.actionCardConfig[key] < 0 || normalized.actionCardConfig[key] > 5) {
      errors.push(`${key} 수량은 0~5 사이여야 합니다.`);
    }
  }

  return {
    normalized,
    isValid: errors.length === 0,
    errors
  };
}

export function getRulesWarnings(rules: RoomRules) {
  const warnings: string[] = [];
  const totalActions = totalActionCards(rules.actionCardConfig);

  if (rules.restaurantCardCountPerPlayer === 5 && totalActions <= 4) {
    warnings.push("식당 카드가 많고 액션 카드가 적어서 게임이 빠르게 소진될 수 있습니다.");
  }

  const maxOneType = Object.values(rules.actionCardConfig).filter((count) => count === 5).length;
  if (maxOneType >= 2) {
    warnings.push("특정 액션 카드에 편중된 룰입니다. 밸런스가 크게 흔들릴 수 있습니다.");
  }

  return warnings;
}
