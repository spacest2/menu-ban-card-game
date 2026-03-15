import { create } from "zustand";
import { ensureAnonymousAuth, isFirebaseConfigured } from "../lib/firebase";
import {
  createRoomWithGeneratedCode,
  endMyTurn,
  ensureMyPrivateGameState,
  fetchInitialRoomBundle,
  joinRoom,
  playMyAction,
  revealMyNextCard,
  selectInitialReveal,
  setReady,
  startRoom,
  submitRestaurants,
  subscribeRoom,
  upsertRules
} from "../lib/firestore";
import { PublicRoomState, RoomRules } from "../types/game";

interface GameStore extends PublicRoomState {
  authReady: boolean;
  loading: boolean;
  error: string | null;
  roomConnectState: "idle" | "connecting" | "ready" | "error";
  nicknameDraft: string;
  roomInput: string;
  unsubscribe?: () => void;
  bootstrap: () => Promise<void>;
  setNicknameDraft: (nickname: string) => void;
  setRoomInput: (roomCode: string) => void;
  createRoom: (nickname: string) => Promise<void>;
  joinRoom: (roomCode: string, nickname: string) => Promise<void>;
  connectToRoom: (roomCode: string) => Promise<void>;
  hydratePrivateGameState: (roomCode: string) => Promise<void>;
  saveRules: (roomCode: string, rules: RoomRules) => Promise<void>;
  submitRestaurants: (roomCode: string, names: string[]) => Promise<void>;
  setReady: (roomCode: string, ready: boolean) => Promise<void>;
  startGame: (roomCode: string) => Promise<void>;
  selectReveal: (roomCode: string, cardId: string) => Promise<void>;
  revealNextCard: (roomCode: string, cardId: string) => Promise<void>;
  playAction: (roomCode: string, actionId: string, targetCardId: string) => Promise<void>;
  endTurn: (roomCode: string) => Promise<void>;
  clearError: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  room: null,
  players: [],
  logs: [],
  me: null,
  myPlayerId: null,
  authReady: false,
  loading: false,
  error: null,
  roomConnectState: "idle",
  nicknameDraft: "",
  roomInput: "",
  bootstrap: async () => {
    if (!isFirebaseConfigured) {
      set({
        authReady: true,
        error: "Firebase 환경변수가 없습니다. .env.local 설정을 먼저 확인하세요."
      });
      return;
    }

    try {
      const user = await ensureAnonymousAuth();
      set({
        authReady: true,
        myPlayerId: user?.uid ?? null,
        error: user?.uid
          ? null
          : "익명 로그인에 실패했습니다. Firebase Authentication 설정을 확인하세요."
      });
    } catch (error) {
      set({
        authReady: true,
        myPlayerId: null,
        error:
          error instanceof Error
            ? error.message
            : "익명 로그인에 실패했습니다. Anonymous 로그인을 켰는지 확인하세요."
      });
    }
  },
  setNicknameDraft: (nicknameDraft) => set({ nicknameDraft }),
  setRoomInput: (roomInput) => set({ roomInput: roomInput.toUpperCase() }),
  createRoom: async (nickname) => {
    const playerId = get().myPlayerId;
    if (!nickname.trim()) {
      set({ error: "닉네임을 먼저 입력하세요." });
      return;
    }
    if (!playerId) {
      set({ error: "로그인 준비가 아직 끝나지 않았습니다." });
      return;
    }

    set({ loading: true, error: null });
    try {
      const roomCode = await createRoomWithGeneratedCode(playerId, nickname);
      console.info("[room] create success", { roomCode, playerId, nickname });
      await get().connectToRoom(roomCode);
      window.history.replaceState({}, "", `?room=${roomCode}`);
      window.dispatchEvent(new Event("codex:navigation"));
    } catch (error) {
      console.error("[room] create failed", { error });
      set({ error: error instanceof Error ? `방 생성 실패: ${error.message}` : "방 생성 실패" });
    } finally {
      set({ loading: false });
    }
  },
  joinRoom: async (roomCode, nickname) => {
    const playerId = get().myPlayerId;
    if (!nickname.trim()) {
      set({ error: "닉네임을 먼저 입력하세요." });
      return;
    }
    if (!roomCode.trim()) {
      set({ error: "방 코드를 입력하세요." });
      return;
    }
    if (!playerId) {
      set({ error: "로그인 준비가 아직 끝나지 않았습니다." });
      return;
    }

    set({ loading: true, error: null });
    try {
      await joinRoom(roomCode, playerId, nickname);
      console.info("[room] join success", { roomCode, playerId, nickname });
      await get().connectToRoom(roomCode);
      window.history.replaceState({}, "", `?room=${roomCode}`);
      window.dispatchEvent(new Event("codex:navigation"));
    } catch (error) {
      console.error("[room] join failed", { roomCode, error });
      set({ error: error instanceof Error ? `방 입장 실패: ${error.message}` : "방 입장 실패" });
    } finally {
      set({ loading: false });
    }
  },
  connectToRoom: async (roomCode) => {
    const playerId = get().myPlayerId;
    if (!playerId) {
      set({
        roomConnectState: "error",
        error: "로그인 상태가 준비되지 않아 방에 연결할 수 없습니다."
      });
      return;
    }

    console.info("[room] connect start", { roomCode, playerId });
    get().unsubscribe?.();
    set({
      room: null,
      players: [],
      logs: [],
      me: null,
      roomInput: roomCode,
      error: null,
      roomConnectState: "connecting"
    });

    try {
      const initial = await fetchInitialRoomBundle(roomCode, playerId);
      if (!initial.room) {
        set({
          roomConnectState: "error",
          error: "방 상태를 불러오지 못했습니다. 권한 문제 또는 문서 없음일 수 있습니다."
        });
        return;
      }

      const hasPublicPlayer = initial.players.some((player) => player.playerId === playerId);
      if (!hasPublicPlayer) {
        set({
          roomConnectState: "error",
          error: "방 생성 후 host player 정보가 없어 로비에 진입하지 못했습니다."
        });
        return;
      }

      set({
        room: initial.room,
        players: initial.players,
        logs: initial.logs,
        me: initial.me,
        roomConnectState: "ready"
      });
    } catch (error) {
      console.error("[room] initial fetch failed", { roomCode, playerId, error });
      set({
        roomConnectState: "error",
        error:
          error instanceof Error
            ? `방 상태를 불러오지 못했습니다: ${error.message}`
            : "방 상태를 불러오지 못했습니다."
      });
      return;
    }

    const unsubscribe = subscribeRoom(roomCode, playerId, {
      onRoom: (room) =>
        set({
          room,
          roomConnectState: room ? "ready" : "error",
          error: room ? get().error : "방 문서를 찾지 못했습니다."
        }),
      onPlayers: (players) => set({ players }),
      onLogs: (logs) => set({ logs }),
      onMe: (me) => set({ me }),
      onError: (message) => set({ roomConnectState: "error", error: message })
    });

    set({ unsubscribe });
  },
  hydratePrivateGameState: async (roomCode) => {
    const playerId = get().myPlayerId;
    if (!playerId) return;
    try {
      await ensureMyPrivateGameState(roomCode, playerId);
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? `개인 게임 상태 초기화 실패: ${error.message}`
            : "개인 게임 상태 초기화 실패"
      });
    }
  },
  saveRules: async (roomCode, rules) => {
    const playerId = get().myPlayerId;
    if (!playerId) return;
    try {
      await upsertRules(roomCode, playerId, rules);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "설정 저장 실패" });
    }
  },
  submitRestaurants: async (roomCode, names) => {
    const playerId = get().myPlayerId;
    const me = get().players.find((player) => player.playerId === playerId);
    if (!playerId || !me) {
      set({ error: "플레이어 정보를 찾지 못해 식당 카드를 제출할 수 없습니다." });
      return;
    }
    try {
      await submitRestaurants(roomCode, playerId, me.nickname, names);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "식당 카드 제출 실패" });
    }
  },
  setReady: async (roomCode, ready) => {
    const playerId = get().myPlayerId;
    if (!playerId) return;
    try {
      await setReady(roomCode, playerId, ready);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "READY 변경 실패" });
    }
  },
  startGame: async (roomCode) => {
    const playerId = get().myPlayerId;
    if (!playerId) return;
    try {
      await startRoom(roomCode, playerId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "게임 시작 실패" });
    }
  },
  selectReveal: async (roomCode, cardId) => {
    const playerId = get().myPlayerId;
    if (!playerId) return;
    try {
      await selectInitialReveal(roomCode, playerId, cardId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "첫 공개 카드 선택 실패" });
    }
  },
  revealNextCard: async (roomCode, cardId) => {
    const playerId = get().myPlayerId;
    if (!playerId) return;
    try {
      await revealMyNextCard(roomCode, playerId, cardId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "새 카드 공개 실패" });
    }
  },
  playAction: async (roomCode, actionId, targetCardId) => {
    const playerId = get().myPlayerId;
    if (!playerId) return;
    try {
      await playMyAction(roomCode, playerId, actionId, targetCardId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "액션 카드 사용 실패" });
    }
  },
  endTurn: async (roomCode) => {
    const playerId = get().myPlayerId;
    if (!playerId) return;
    try {
      await endMyTurn(roomCode, playerId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "턴 종료 실패" });
    }
  },
  clearError: () => set({ error: null })
}));
