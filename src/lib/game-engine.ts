import {
  ActionCard,
  ActionLog,
  ActionType,
  PlayerPrivate,
  PlayerPublic,
  RestaurantCard,
  RoomDoc,
  RoomRules
} from "../types/game";
import {
  ACTION_LABELS,
  ACTION_VALUES,
  BASE_RESTAURANT_HP,
  DEFAULT_RULES,
  MAX_ACTIONS_PER_TURN,
  MIN_PLAYERS
} from "./constants";
import { createId } from "./utils";
import { validateRules } from "./rules";

export interface StartGameResult {
  nextRoom: RoomDoc;
  nextPrivates: Record<string, PlayerPrivate>;
  nextPublics: Record<string, PlayerPublic>;
  log: ActionLog;
}

export function shufflePlayers(playerIds: string[]) {
  const cloned = [...playerIds];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }
  return cloned;
}

export function buildActionCards(ownerPlayerId: string, rules: RoomRules): ActionCard[] {
  const cards: ActionCard[] = [];
  for (const [type, count] of Object.entries(rules.actionCardConfig) as Array<
    [ActionType, number]
  >) {
    for (let index = 0; index < count; index += 1) {
      cards.push({
        actionId: createId(type),
        ownerPlayerId,
        type,
        used: false
      });
    }
  }
  return cards;
}

export function buildRestaurantCards(
  ownerPlayerId: string,
  ownerNickname: string,
  names: string[]
): RestaurantCard[] {
  return names.map((restaurantName) => ({
    cardId: createId("restaurant"),
    ownerPlayerId,
    ownerNickname,
    restaurantName: restaurantName.trim(),
    hp: BASE_RESTAURANT_HP,
    baseHp: BASE_RESTAURANT_HP,
    isDead: false,
    isRevealed: false,
    isInGraveyard: false
  }));
}

export function canStartGame(
  room: RoomDoc,
  players: PlayerPublic[]
) {
  const ruleValidation = validateRules(room.rules);
  if (!ruleValidation.isValid) {
    return { ok: false as const, message: ruleValidation.errors[0] };
  }

  if (players.length < MIN_PLAYERS) {
    return { ok: false as const, message: "최소 2명 이상이 필요합니다." };
  }

  for (const player of players) {
    if (!player.isReady) {
      return { ok: false as const, message: `${player.nickname} 님이 아직 READY가 아닙니다.` };
    }

    if (player.submittedRestaurantCount !== room.rules.restaurantCardCountPerPlayer) {
      return { ok: false as const, message: `${player.nickname} 님의 식당 카드 제출 수가 맞지 않습니다.` };
    }
  }

  return { ok: true as const };
}

export function startGame(
  room: RoomDoc,
  players: PlayerPublic[]
): StartGameResult {
  const turnOrder = shufflePlayers(players.map((player) => player.playerId));
  const nextPublics: Record<string, PlayerPublic> = {};

  for (const player of players) {
    const actionCards = buildActionCards(player.playerId, room.rules);
    nextPublics[player.playerId] = {
      ...player,
      remainingActionCardCount: actionCards.length,
      aliveRevealedCardId: null,
      revealedCardId: null,
      pendingRevealCard: null
    };
  }

  return {
    nextRoom: {
      ...room,
      status: "reveal_select",
      turnOrder,
      currentTurnIndex: 0,
      turnPhase: "awaiting_reveal_or_revive",
      cardsPlayedThisTurn: 0,
      tableCards: [],
      graveyardCards: [],
      finalCandidates: [],
      updatedAt: Date.now(),
      version: room.version + 1
    },
    nextPrivates: {},
    nextPublics,
    log: {
      logId: createId("log"),
      actorPlayerId: room.hostId,
      actorNickname: "SYSTEM",
      actionType: "system",
      targetCardId: null,
      targetRestaurantName: null,
      targetOwnerNickname: null,
      value: null,
      message: "게임이 시작되었습니다. 각자 첫 공개 식당 카드를 선택하세요.",
      timestamp: Date.now()
    }
  };
}

export function revealSelectedCards(
  room: RoomDoc,
  players: PlayerPublic[]
): {
  nextRoom: RoomDoc;
  nextPrivates: Record<string, PlayerPrivate>;
  nextPublics: Record<string, PlayerPublic>;
  logs: ActionLog[];
} {
  const tableCards: RestaurantCard[] = [];
  const nextPublics: Record<string, PlayerPublic> = {};
  const logs: ActionLog[] = [];

  for (const player of players) {
    const selectedCard = player.pendingRevealCard;
    if (!selectedCard) {
      throw new Error("모든 플레이어가 공개 카드를 선택해야 합니다.");
    }
    tableCards.push({ ...selectedCard });
    nextPublics[player.playerId] = {
      ...player,
      revealedCardId: selectedCard.cardId,
      aliveRevealedCardId: selectedCard.cardId
    };
    logs.push({
      logId: createId("log"),
      actorPlayerId: player.playerId,
      actorNickname: player.nickname,
      actionType: "reveal",
      targetCardId: selectedCard.cardId,
      targetRestaurantName: selectedCard.restaurantName,
      targetOwnerNickname: player.nickname,
      value: null,
      message: `${player.nickname} 님이 ${selectedCard.restaurantName} 카드를 공개했습니다.`,
      timestamp: Date.now()
    });
  }

  return {
    nextRoom: {
      ...room,
      status: "playing",
      tableCards,
      graveyardCards: [],
      turnPhase: "action" as const,
      cardsPlayedThisTurn: 0,
      updatedAt: Date.now(),
      version: room.version + 1
    },
    nextPrivates: {},
    nextPublics,
    logs
  };
}

export function currentPlayerId(room: RoomDoc) {
  return room.turnOrder[room.currentTurnIndex] ?? null;
}

export function hasAliveRevealedCard(room: RoomDoc, playerId: string) {
  return room.tableCards.some((card) => card.ownerPlayerId === playerId && !card.isDead);
}

export function shouldRequireRevealOrRevive(room: RoomDoc, playerId: string) {
  return !hasAliveRevealedCard(room, playerId);
}

export function revealNextOwnCard(
  room: RoomDoc,
  player: PlayerPublic,
  privateState: PlayerPrivate,
  cardId: string
) {
  const selectedCard = privateState.restaurantCards.find((card) => card.cardId === cardId);
  if (!selectedCard || selectedCard.isRevealed) {
    throw new Error("공개 가능한 새 식당 카드가 없습니다.");
  }

  const nextRestaurantCards = privateState.restaurantCards.map((card) =>
    card.cardId === cardId ? { ...card, isRevealed: true, isDead: false, isInGraveyard: false } : card
  );

  const nextCard = nextRestaurantCards.find((card) => card.cardId === cardId)!;

  return {
    nextRoom: {
      ...room,
      tableCards: [...room.tableCards, nextCard],
      turnPhase: "action" as const,
      updatedAt: Date.now(),
      version: room.version + 1
    },
    nextPrivate: {
      ...privateState,
      restaurantCards: nextRestaurantCards
    },
    nextPublic: {
      ...player,
      revealedCardId: cardId,
      aliveRevealedCardId: cardId
    },
    log: {
      logId: createId("log"),
      actorPlayerId: player.playerId,
      actorNickname: player.nickname,
      actionType: "reveal",
      targetCardId: cardId,
      targetRestaurantName: nextCard.restaurantName,
      targetOwnerNickname: player.nickname,
      value: null,
      message: `${player.nickname} 님이 새 식당 카드 ${nextCard.restaurantName} 를 공개했습니다.`,
      timestamp: Date.now()
    } satisfies ActionLog
  };
}

function markCardMoved(room: RoomDoc, nextCard: RestaurantCard) {
  const existsOnTable = room.tableCards.some((card) => card.cardId === nextCard.cardId);
  const nextTableCards = (
    existsOnTable
      ? room.tableCards.map((card) => (card.cardId === nextCard.cardId ? nextCard : card))
      : nextCard.isInGraveyard
        ? room.tableCards
        : [...room.tableCards, nextCard]
  ).filter((card) => !card.isInGraveyard);

  const graveyardWithoutCard = room.graveyardCards.filter((card) => card.cardId !== nextCard.cardId);
  const nextGraveyardCards = nextCard.isInGraveyard
    ? [...graveyardWithoutCard, nextCard]
    : graveyardWithoutCard;

  return {
    tableCards: nextTableCards,
    graveyardCards: nextGraveyardCards
  };
}

export function playActionCard(params: {
  room: RoomDoc;
  actor: PlayerPublic;
  actorPrivate: PlayerPrivate;
  playersById: Record<string, PlayerPublic>;
  actionId: string;
  targetCardId: string;
}) {
  const { room, actor, actorPrivate, playersById, actionId, targetCardId } = params;

  if (currentPlayerId(room) !== actor.playerId) {
    throw new Error("현재 턴 플레이어만 행동할 수 있습니다.");
  }
  if (room.status !== "playing") {
    throw new Error("플레이 중인 방에서만 행동할 수 있습니다.");
  }
  if (room.cardsPlayedThisTurn >= MAX_ACTIONS_PER_TURN) {
    throw new Error("한 턴에는 최대 3장의 액션 카드만 사용할 수 있습니다.");
  }

  const actionCard = actorPrivate.actionCards.find((card) => card.actionId === actionId);
  if (!actionCard || actionCard.used) {
    throw new Error("이미 사용했거나 존재하지 않는 액션 카드입니다.");
  }

  let targetCard =
    room.tableCards.find((card) => card.cardId === targetCardId) ??
    room.graveyardCards.find((card) => card.cardId === targetCardId);
  if (!targetCard) {
    throw new Error("대상 식당 카드를 찾을 수 없습니다.");
  }

  const nextActionCards = actorPrivate.actionCards.map((card) =>
    card.actionId === actionId ? { ...card, used: true } : card
  );

  if (actionCard.type === "revive") {
    if (!targetCard.isInGraveyard) {
      throw new Error("부활은 죽은 카드에만 사용할 수 있습니다.");
    }
    targetCard = {
      ...targetCard,
      hp: 5,
      isDead: false,
      isInGraveyard: false,
      isRevealed: true
    };
  } else {
    if (targetCard.isInGraveyard || targetCard.isDead) {
      throw new Error("죽은 카드에는 해당 액션을 사용할 수 없습니다.");
    }
    if (actionCard.type === "assassinate") {
      targetCard = {
        ...targetCard,
        hp: 0,
        isDead: true,
        isInGraveyard: true
      };
    } else if (actionCard.type.startsWith("attack")) {
      const nextHp = targetCard.hp - ACTION_VALUES[actionCard.type];
      targetCard = {
        ...targetCard,
        hp: nextHp,
        isDead: nextHp <= 0,
        isInGraveyard: nextHp <= 0
      };
    } else if (actionCard.type.startsWith("heal")) {
      targetCard = {
        ...targetCard,
        hp: targetCard.hp + ACTION_VALUES[actionCard.type]
      };
    }
  }

  const moved = markCardMoved(room, targetCard);
  const targetOwner = playersById[targetCard.ownerPlayerId];
  const nextRoomBase: RoomDoc = {
    ...room,
    tableCards: moved.tableCards,
    graveyardCards: moved.graveyardCards,
    cardsPlayedThisTurn: room.cardsPlayedThisTurn + 1,
    updatedAt: Date.now(),
    version: room.version + 1
  };

  const allRemainingCounts = Object.values(playersById).map((player) =>
    player.playerId === actor.playerId
      ? nextActionCards.filter((card) => !card.used).length
      : player.remainingActionCardCount
  );

  const nextRoom =
    allRemainingCounts.every((count) => count === 0)
      ? {
          ...nextRoomBase,
          status: "finished" as const,
          finalCandidates: moved.tableCards.filter((card) => !card.isDead)
        }
      : nextRoomBase;

  return {
    nextRoom,
    nextPrivate: {
      ...actorPrivate,
      actionCards: nextActionCards
    },
    nextPublic: {
      ...actor,
      remainingActionCardCount: nextActionCards.filter((card) => !card.used).length
    },
    targetPublicPatch: targetOwner
      ? {
          playerId: targetOwner.playerId,
          aliveRevealedCardId: targetCard.isInGraveyard ? null : targetCard.cardId
        }
      : null,
    log: {
      logId: createId("log"),
      actorPlayerId: actor.playerId,
      actorNickname: actor.nickname,
      actionType: actionCard.type,
      targetCardId: targetCard.cardId,
      targetRestaurantName: targetCard.restaurantName,
      targetOwnerNickname: targetOwner?.nickname ?? null,
      value:
        actionCard.type === "assassinate"
          ? null
          : actionCard.type === "revive"
            ? 5
            : ACTION_VALUES[actionCard.type],
      message:
        actionCard.type === "assassinate"
          ? `${actor.nickname} 님이 ${targetCard.restaurantName} 카드를 암살했습니다.`
          : actionCard.type === "revive"
            ? `${actor.nickname} 님이 ${targetCard.restaurantName} 카드를 체력 5로 부활시켰습니다.`
            : `${actor.nickname} 님이 ${ACTION_LABELS[actionCard.type]} 카드를 ${targetCard.restaurantName} 에 사용했습니다.`,
      timestamp: Date.now()
    } satisfies ActionLog
  };
}

export function endTurn(room: RoomDoc, playersById: Record<string, PlayerPublic>) {
  const nextIndex = room.turnOrder.length === 0 ? 0 : (room.currentTurnIndex + 1) % room.turnOrder.length;
  const nextPlayerId = room.turnOrder[nextIndex];
  const nextPlayer = nextPlayerId ? playersById[nextPlayerId] : null;
  const mustRevealOrRevive = nextPlayerId ? shouldRequireRevealOrRevive(room, nextPlayerId) : false;

  return {
    nextRoom: {
      ...room,
      currentTurnIndex: nextIndex,
      cardsPlayedThisTurn: 0,
      turnPhase: mustRevealOrRevive ? "awaiting_reveal_or_revive" : "action",
      updatedAt: Date.now(),
      version: room.version + 1
    },
    log: {
      logId: createId("log"),
      actorPlayerId: nextPlayerId ?? "system",
      actorNickname: "SYSTEM",
      actionType: "end_turn",
      targetCardId: null,
      targetRestaurantName: null,
      targetOwnerNickname: null,
      value: null,
      message: nextPlayer ? `턴이 ${nextPlayer.nickname} 님에게 넘어갔습니다.` : "턴이 종료되었습니다.",
      timestamp: Date.now()
    } satisfies ActionLog
  };
}

export function createEmptyRoom(roomId: string, roomCode: string, hostId: string): RoomDoc {
  return {
    roomId,
    roomCode,
    hostId,
    status: "lobby",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    rules: DEFAULT_RULES,
    rulesDirty: false,
    playersCount: 1,
    turnOrder: [],
    currentTurnIndex: 0,
    turnPhase: "awaiting_reveal_or_revive",
    cardsPlayedThisTurn: 0,
    tableCards: [],
    graveyardCards: [],
    finalCandidates: []
  };
}
