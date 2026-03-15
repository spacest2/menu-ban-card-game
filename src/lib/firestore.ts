import {
  collection,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  type UpdateData,
  updateDoc
} from "firebase/firestore";
import { db } from "./firebase";
import {
  ActionLog,
  PlayerPrivate,
  PlayerPublic,
  RoomDoc,
  RoomRules
} from "../types/game";
import {
  buildRestaurantCards,
  canStartGame,
  buildActionCards,
  currentPlayerId,
  createEmptyRoom,
  endTurn,
  playActionCard,
  revealNextOwnCard,
  revealSelectedCards,
  startGame
} from "./game-engine";
import { createId } from "./utils";
import { validateRules } from "./rules";
import { DEFAULT_RULES, MAX_PLAYERS } from "./constants";
import { generateRoomCode } from "./room-code";

export function roomRef(roomCode: string) {
  return doc(db, "rooms", roomCode) as DocumentReference<RoomDoc>;
}

export function playersRef(roomCode: string) {
  return collection(db, "rooms", roomCode, "players");
}

export function privatePlayersRef(roomCode: string) {
  return collection(db, "rooms", roomCode, "privatePlayers");
}

export function logsRef(roomCode: string) {
  return collection(db, "rooms", roomCode, "logs");
}

export async function fetchInitialRoomBundle(roomCode: string, playerId: string) {
  console.info("[room] fetchInitialRoomBundle start", { roomCode, playerId });

  const [roomSnapshot, playersSnapshot, logsSnapshot, meSnapshot] = await Promise.all([
    getDoc(roomRef(roomCode)),
    getDocs(playersRef(roomCode)),
    getDocs(query(logsRef(roomCode), orderBy("timestamp", "desc"), limit(40))),
    getDoc(doc(privatePlayersRef(roomCode), playerId))
  ]);

  const room = roomSnapshot.exists() ? (roomSnapshot.data() as RoomDoc) : null;
  const players = playersSnapshot.docs.map((item) => item.data() as PlayerPublic);
  const logs = logsSnapshot.docs.map((item) => item.data() as ActionLog);
  const me = meSnapshot.exists() ? (meSnapshot.data() as PlayerPrivate) : null;

  console.info("[room] fetchInitialRoomBundle result", {
    roomExists: Boolean(room),
    playersCount: players.length,
    meExists: Boolean(me)
  });

  return { room, players, logs, me };
}

export async function createRoom(roomCode: string, playerId: string, nickname: string) {
  const room = createEmptyRoom(createId("room"), roomCode, playerId);
  const publicPlayer: PlayerPublic = {
    playerId,
    nickname,
    isReady: false,
    isHost: true,
    revealedCardId: null,
    remainingActionCardCount: 0,
    hasSubmittedRestaurants: false,
    submittedRestaurantCount: 0,
    aliveRevealedCardId: null,
    pendingRevealCard: null
  };
  const privatePlayer: PlayerPrivate = {
    playerId,
    restaurantCards: [],
    actionCards: [],
    revealSelectionCardId: null
  };
  const logId = createId("log");

  await runTransaction(db, async (transaction) => {
    const roomDoc = roomRef(roomCode);
    const roomSnapshot = await transaction.get(roomDoc);
    if (roomSnapshot.exists()) {
      throw new Error("이미 사용 중인 방 코드입니다. 다시 시도하세요.");
    }

    transaction.set(roomDoc, room);
    transaction.set(doc(playersRef(roomCode), playerId), publicPlayer);
    transaction.set(doc(privatePlayersRef(roomCode), playerId), privatePlayer);
    transaction.set(doc(logsRef(roomCode), logId), {
      logId,
      actorPlayerId: playerId,
      actorNickname: "SYSTEM",
      actionType: "system",
      targetCardId: null,
      targetRestaurantName: null,
      targetOwnerNickname: null,
      value: null,
      message: `${nickname} 님이 방을 만들었습니다.`,
      timestamp: Date.now()
    } satisfies ActionLog);
  });

  return roomCode;
}

export async function createRoomWithGeneratedCode(playerId: string, nickname: string) {
  for (let index = 0; index < 5; index += 1) {
    const roomCode = generateRoomCode();
    try {
      await createRoom(roomCode, playerId, nickname);
      return roomCode;
    } catch (error) {
      if (index === 4) throw error;
    }
  }

  throw new Error("방 코드를 생성하지 못했습니다.");
}

export async function joinRoom(roomCode: string, playerId: string, nickname: string) {
  await runTransaction(db, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef(roomCode));
    if (!roomSnapshot.exists()) {
      throw new Error("존재하지 않는 방 코드입니다.");
    }

    const room = roomSnapshot.data();
    if (room.status !== "lobby") {
      throw new Error("이미 시작된 방에는 입장할 수 없습니다.");
    }

    if (room.playersCount >= MAX_PLAYERS) {
      throw new Error("방 인원이 가득 찼습니다.");
    }

    transaction.set(doc(playersRef(roomCode), playerId), {
      playerId,
      nickname,
      isReady: false,
      isHost: false,
      revealedCardId: null,
      remainingActionCardCount: 0,
      hasSubmittedRestaurants: false,
      submittedRestaurantCount: 0,
      aliveRevealedCardId: null,
      pendingRevealCard: null
    } satisfies PlayerPublic);
    transaction.set(doc(privatePlayersRef(roomCode), playerId), {
      playerId,
      restaurantCards: [],
      actionCards: [],
      revealSelectionCardId: null
    } satisfies PlayerPrivate);
    transaction.update(roomRef(roomCode), {
      playersCount: increment(1),
      updatedAt: Date.now(),
      version: room.version + 1
    } satisfies UpdateData<RoomDoc>);
    const logId = createId("log");
    transaction.set(doc(logsRef(roomCode), logId), {
      logId,
      actorPlayerId: playerId,
      actorNickname: "SYSTEM",
      actionType: "system",
      targetCardId: null,
      targetRestaurantName: null,
      targetOwnerNickname: null,
      value: null,
      message: `${nickname} 님이 입장했습니다.`,
      timestamp: Date.now()
    } satisfies ActionLog);
  });
}

export async function upsertRules(roomCode: string, actorId: string, rules: RoomRules) {
  const validation = validateRules(rules);
  if (!validation.isValid) {
    throw new Error(validation.errors[0]);
  }

  await runTransaction(db, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef(roomCode));
    if (!roomSnapshot.exists()) {
      throw new Error("방을 찾을 수 없습니다.");
    }
    const room = roomSnapshot.data();
    if (room.hostId !== actorId) {
      throw new Error("방장만 설정을 변경할 수 있습니다.");
    }
    if (room.status !== "lobby") {
      throw new Error("게임 시작 후에는 설정을 바꿀 수 없습니다.");
    }

    transaction.update(roomRef(roomCode), {
      rules: validation.normalized,
      rulesDirty: JSON.stringify(validation.normalized) !== JSON.stringify(DEFAULT_RULES),
      updatedAt: Date.now(),
      version: room.version + 1
    } satisfies Partial<RoomDoc>);
  });
}

export async function submitRestaurants(
  roomCode: string,
  actorId: string,
  nickname: string,
  names: string[]
) {
  await runTransaction(db, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef(roomCode));
    if (!roomSnapshot.exists()) {
      throw new Error("방이 없습니다.");
    }
    const room = roomSnapshot.data();

    if (room.status !== "lobby") {
      throw new Error("로비에서만 식당 카드를 제출할 수 있습니다.");
    }
    if (names.length !== room.rules.restaurantCardCountPerPlayer) {
      throw new Error("설정된 개수만큼 식당 카드를 제출해야 합니다.");
    }
    if (names.some((name) => name.trim().length < 1)) {
      throw new Error("모든 식당 이름을 입력해야 합니다.");
    }

    const cards = buildRestaurantCards(actorId, nickname, names);
    transaction.update(doc(privatePlayersRef(roomCode), actorId), {
      restaurantCards: cards,
      revealSelectionCardId: null
    } satisfies Partial<PlayerPrivate>);
    transaction.update(doc(playersRef(roomCode), actorId), {
      hasSubmittedRestaurants: true,
      submittedRestaurantCount: cards.length,
      isReady: false
    } satisfies Partial<PlayerPublic>);
  });
}

export async function setReady(roomCode: string, actorId: string, ready: boolean) {
  await runTransaction(db, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef(roomCode));
    if (!roomSnapshot.exists()) {
      throw new Error("방이 없습니다.");
    }
    const room = roomSnapshot.data();
    if (room.status !== "lobby") {
      throw new Error("로비에서만 READY 상태를 바꿀 수 있습니다.");
    }

    const playerSnapshot = await transaction.get(doc(playersRef(roomCode), actorId));
    if (!playerSnapshot.exists()) {
      throw new Error("플레이어 정보가 없습니다.");
    }
    const player = playerSnapshot.data() as PlayerPublic;
    if (!player.hasSubmittedRestaurants) {
      throw new Error("식당 카드 제출 후 READY 할 수 있습니다.");
    }

    transaction.update(doc(playersRef(roomCode), actorId), {
      isReady: ready
    } satisfies Partial<PlayerPublic>);
  });
}

export async function startRoom(roomCode: string, actorId: string) {
  const roomSnapshot = await getDoc(roomRef(roomCode));
  if (!roomSnapshot.exists()) {
    throw new Error("방이 없습니다.");
  }
  const room = roomSnapshot.data();
  if (room.hostId !== actorId) {
    throw new Error("방장만 시작할 수 있습니다.");
  }

  const publicsSnapshot = await getDocs(playersRef(roomCode));
  const publics = publicsSnapshot.docs.map((item) => item.data() as PlayerPublic);
  const eligibility = canStartGame(room, publics);
  if (!eligibility.ok) {
    throw new Error(eligibility.message);
  }

  const result = startGame(room, publics);
  await runTransaction(db, async (transaction) => {
    transaction.set(roomRef(roomCode), result.nextRoom);
    for (const publicPlayer of publics) {
      transaction.set(doc(playersRef(roomCode), publicPlayer.playerId), result.nextPublics[publicPlayer.playerId]);
    }
    transaction.set(doc(logsRef(roomCode), result.log.logId), result.log);
  });
}

export async function selectInitialReveal(roomCode: string, actorId: string, cardId: string) {
  const [privateSnapshot, publicSnapshot] = await Promise.all([
    getDoc(doc(privatePlayersRef(roomCode), actorId)),
    getDoc(doc(playersRef(roomCode), actorId))
  ]);
  if (!privateSnapshot.exists() || !publicSnapshot.exists()) {
    throw new Error("플레이어 상태를 찾을 수 없습니다.");
  }
  const me = privateSnapshot.data() as PlayerPrivate;
  const selected = me.restaurantCards.find((card) => card.cardId === cardId);
  if (!selected) {
    throw new Error("선택한 식당 카드가 없습니다.");
  }

  await updateDoc(doc(privatePlayersRef(roomCode), actorId), {
    revealSelectionCardId: cardId,
    restaurantCards: me.restaurantCards.map((card) =>
      card.cardId === cardId ? { ...card, isRevealed: true } : card
    )
  } satisfies Partial<PlayerPrivate>);
  await updateDoc(doc(playersRef(roomCode), actorId), {
    pendingRevealCard: {
      ...selected,
      isRevealed: true
    }
  } satisfies Partial<PlayerPublic>);

  const roomSnapshot = await getDoc(roomRef(roomCode));
  if (!roomSnapshot.exists()) return;
  const room = roomSnapshot.data();
  if (room.status !== "reveal_select") return;

  const publicsSnapshot = await getDocs(playersRef(roomCode));
  const publics = publicsSnapshot.docs.map((item) => item.data() as PlayerPublic);
  const everyoneSelected = publics.every((player) => Boolean(player.pendingRevealCard));
  if (!everyoneSelected) return;

  const result = revealSelectedCards(room, publics);
  await runTransaction(db, async (transaction) => {
    transaction.set(roomRef(roomCode), result.nextRoom);
    for (const player of publics) {
      transaction.set(doc(playersRef(roomCode), player.playerId), result.nextPublics[player.playerId]);
    }
    for (const log of result.logs) {
      transaction.set(doc(logsRef(roomCode), log.logId), log);
    }
  });
}

export async function revealMyNextCard(roomCode: string, actorId: string, cardId: string) {
  const [roomSnapshot, playerSnapshot, privateSnapshot] = await Promise.all([
    getDoc(roomRef(roomCode)),
    getDoc(doc(playersRef(roomCode), actorId)),
    getDoc(doc(privatePlayersRef(roomCode), actorId))
  ]);

  if (!roomSnapshot.exists() || !playerSnapshot.exists() || !privateSnapshot.exists()) {
    throw new Error("필수 데이터가 없습니다.");
  }
  const room = roomSnapshot.data();
  if (room.status !== "playing") {
    throw new Error("플레이 중에만 새 카드를 공개할 수 있습니다.");
  }
  if (currentPlayerId(room) !== actorId) {
    throw new Error("현재 턴 플레이어만 새 카드를 공개할 수 있습니다.");
  }

  const result = revealNextOwnCard(
    room,
    playerSnapshot.data() as PlayerPublic,
    privateSnapshot.data() as PlayerPrivate,
    cardId
  );

  await runTransaction(db, async (transaction) => {
    transaction.set(roomRef(roomCode), result.nextRoom);
    transaction.set(doc(playersRef(roomCode), actorId), result.nextPublic);
    transaction.set(doc(privatePlayersRef(roomCode), actorId), result.nextPrivate);
    transaction.set(doc(logsRef(roomCode), result.log.logId), result.log);
  });
}

export async function playMyAction(
  roomCode: string,
  actorId: string,
  actionId: string,
  targetCardId: string
) {
  const [roomSnapshot, publicsSnapshot, privateSnapshot] = await Promise.all([
    getDoc(roomRef(roomCode)),
    getDocs(playersRef(roomCode)),
    getDoc(doc(privatePlayersRef(roomCode), actorId))
  ]);
  if (!roomSnapshot.exists() || !privateSnapshot.exists()) {
    throw new Error("필수 데이터가 없습니다.");
  }

  const players = publicsSnapshot.docs.map((item) => item.data() as PlayerPublic);
  const playersById = players.reduce<Record<string, PlayerPublic>>((accumulator, player) => {
    accumulator[player.playerId] = player;
    return accumulator;
  }, {});
  const actor = playersById[actorId];
  if (!actor) {
    throw new Error("플레이어가 없습니다.");
  }

  const result = playActionCard({
    room: roomSnapshot.data(),
    actor,
    actorPrivate: privateSnapshot.data() as PlayerPrivate,
    playersById,
    actionId,
    targetCardId
  });

  await runTransaction(db, async (transaction) => {
    transaction.set(roomRef(roomCode), result.nextRoom);
    transaction.set(doc(playersRef(roomCode), actorId), result.nextPublic);
    transaction.set(doc(privatePlayersRef(roomCode), actorId), result.nextPrivate);
    if (result.targetPublicPatch) {
      transaction.update(doc(playersRef(roomCode), result.targetPublicPatch.playerId), {
        aliveRevealedCardId: result.targetPublicPatch.aliveRevealedCardId
      } satisfies Partial<PlayerPublic>);
    }
    transaction.set(doc(logsRef(roomCode), result.log.logId), result.log);
  });
}

export async function ensureMyPrivateGameState(roomCode: string, actorId: string) {
  const [roomSnapshot, privateSnapshot] = await Promise.all([
    getDoc(roomRef(roomCode)),
    getDoc(doc(privatePlayersRef(roomCode), actorId))
  ]);
  if (!roomSnapshot.exists() || !privateSnapshot.exists()) {
    return;
  }

  const room = roomSnapshot.data();
  const me = privateSnapshot.data() as PlayerPrivate;
  if (room.status === "lobby" || me.actionCards.length > 0) {
    return;
  }

  await updateDoc(doc(privatePlayersRef(roomCode), actorId), {
    actionCards: buildActionCards(actorId, room.rules)
  } satisfies Partial<PlayerPrivate>);
}

export async function endMyTurn(roomCode: string, actorId: string) {
  const [roomSnapshot, publicsSnapshot] = await Promise.all([
    getDoc(roomRef(roomCode)),
    getDocs(playersRef(roomCode))
  ]);
  if (!roomSnapshot.exists()) {
    throw new Error("방이 없습니다.");
  }
  const room = roomSnapshot.data();
  if (currentPlayerId(room) !== actorId) {
    throw new Error("현재 턴 플레이어만 턴을 종료할 수 있습니다.");
  }

  const players = publicsSnapshot.docs.map((item) => item.data() as PlayerPublic);
  const playersById = players.reduce<Record<string, PlayerPublic>>((accumulator, player) => {
    accumulator[player.playerId] = player;
    return accumulator;
  }, {});
  const result = endTurn(room, playersById);

  await runTransaction(db, async (transaction) => {
    transaction.set(roomRef(roomCode), result.nextRoom);
    transaction.set(doc(logsRef(roomCode), result.log.logId), result.log);
  });
}

export function subscribeRoom(
  roomCode: string,
  playerId: string,
  callbacks: {
    onRoom: (room: RoomDoc | null) => void;
    onPlayers: (players: PlayerPublic[]) => void;
    onLogs: (logs: ActionLog[]) => void;
    onMe: (me: PlayerPrivate | null) => void;
    onError: (message: string) => void;
  }
) {
  console.info("[room] subscribe start", { roomCode, playerId });

  const roomUnsubscribe = onSnapshot(
    roomRef(roomCode),
    (snapshot) => {
      console.info("[room] room snapshot", { roomCode, exists: snapshot.exists() });
      callbacks.onRoom(snapshot.exists() ? (snapshot.data() as RoomDoc) : null);
    },
    (error) => {
      console.error("[room] room snapshot error", { roomCode, error });
      callbacks.onError(`방 상태를 불러오지 못했습니다: ${error.message}`);
    }
  );
  const playersUnsubscribe = onSnapshot(
    playersRef(roomCode),
    (snapshot) => {
      console.info("[room] players snapshot", { roomCode, count: snapshot.size });
      callbacks.onPlayers(snapshot.docs.map((item) => item.data() as PlayerPublic));
    },
    (error) => {
      console.error("[room] players snapshot error", { roomCode, error });
      callbacks.onError(`참여자 목록을 불러오지 못했습니다: ${error.message}`);
    }
  );
  const logsUnsubscribe = onSnapshot(
    query(logsRef(roomCode), orderBy("timestamp", "desc"), limit(40)),
    (snapshot) => {
      callbacks.onLogs(snapshot.docs.map((item) => item.data() as ActionLog));
    },
    (error) => {
      console.error("[room] logs snapshot error", { roomCode, error });
      callbacks.onError(`행동 로그를 불러오지 못했습니다: ${error.message}`);
    }
  );
  const meUnsubscribe = onSnapshot(
    doc(privatePlayersRef(roomCode), playerId),
    (snapshot) => {
      console.info("[room] private snapshot", { roomCode, playerId, exists: snapshot.exists() });
      callbacks.onMe(snapshot.exists() ? (snapshot.data() as PlayerPrivate) : null);
    },
    (error) => {
      console.error("[room] private snapshot error", { roomCode, playerId, error });
      callbacks.onError(`내 비공개 상태를 불러오지 못했습니다: ${error.message}`);
    }
  );

  return () => {
    roomUnsubscribe();
    playersUnsubscribe();
    logsUnsubscribe();
    meUnsubscribe();
  };
}
