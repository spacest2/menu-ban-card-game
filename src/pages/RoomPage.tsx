import { useEffect, useMemo, useRef, useState } from "react";
import { ActionHand } from "../components/ActionHand";
import { ActionLogPanel } from "../components/ActionLogPanel";
import { FinalCandidatesPanel } from "../components/FinalCandidatesPanel";
import { MobileShell } from "../components/MobileShell";
import { PlayerList } from "../components/PlayerList";
import { RestaurantSubmissionForm } from "../components/RestaurantSubmissionForm";
import { RevealSelectionPanel } from "../components/RevealSelectionPanel";
import { RuleEditor } from "../components/RuleEditor";
import { TableBoard } from "../components/TableBoard";
import { TurnBanner } from "../components/TurnBanner";
import { ActionLog, ActionType, RestaurantCard, RoomRules } from "../types/game";
import { useGameStore } from "../store/useGameStore";

function isVisualActionLog(log: ActionLog | undefined) {
  if (!log) return false;
  return (
    log.actionType === "assassinate" ||
    log.actionType === "attack5" ||
    log.actionType === "attack3" ||
    log.actionType === "attack2" ||
    log.actionType === "heal5" ||
    log.actionType === "heal3" ||
    log.actionType === "heal2" ||
    log.actionType === "revive"
  );
}

export function RoomPage({ roomCode }: { roomCode: string }) {
  const room = useGameStore((state) => state.room);
  const players = useGameStore((state) => state.players);
  const logs = useGameStore((state) => state.logs);
  const me = useGameStore((state) => state.me);
  const myPlayerId = useGameStore((state) => state.myPlayerId);
  const error = useGameStore((state) => state.error);
  const roomConnectState = useGameStore((state) => state.roomConnectState);
  const clearError = useGameStore((state) => state.clearError);
  const connectToRoom = useGameStore((state) => state.connectToRoom);
  const hydratePrivateGameState = useGameStore((state) => state.hydratePrivateGameState);
  const saveRules = useGameStore((state) => state.saveRules);
  const submitMyRestaurants = useGameStore((state) => state.submitRestaurants);
  const toggleReady = useGameStore((state) => state.setReady);
  const startGame = useGameStore((state) => state.startGame);
  const selectReveal = useGameStore((state) => state.selectReveal);
  const revealNextCard = useGameStore((state) => state.revealNextCard);
  const playAction = useGameStore((state) => state.playAction);
  const endTurn = useGameStore((state) => state.endTurn);

  const [draftRules, setDraftRules] = useState<RoomRules | null>(null);
  const [selectedTargetCardId, setSelectedTargetCardId] = useState<string | null>(null);
  const [selectedActionType, setSelectedActionType] = useState<ActionType | null>(null);
  const [effectLog, setEffectLog] = useState<ActionLog | null>(null);
  const [initialRevealConfirmed, setInitialRevealConfirmed] = useState(false);
  const [publicTableCards, setPublicTableCards] = useState<RestaurantCard[]>([]);
  const [restaurantDeployRequired, setRestaurantDeployRequired] = useState(false);
  const [restaurantDeploySelectionOpen, setRestaurantDeploySelectionOpen] = useState(false);
  const [restaurantDeployNotice, setRestaurantDeployNotice] = useState<string | null>(null);
  const lastCommittedRevealCardIdRef = useRef<string | null>(null);

  useEffect(() => {
    void connectToRoom(roomCode);
  }, [connectToRoom, roomCode]);

  useEffect(() => {
    if (room) {
      setDraftRules(room.rules);
    }
  }, [room]);

  useEffect(() => {
    if (room && room.status !== "lobby") {
      void hydratePrivateGameState(roomCode);
    }
  }, [hydratePrivateGameState, room, roomCode]);

  useEffect(() => {
    setPublicTableCards(room?.tableCards ?? []);
  }, [room?.tableCards]);

  useEffect(() => {
    setInitialRevealConfirmed(Boolean(me?.revealSelectionCardId));
  }, [me?.revealSelectionCardId, roomCode]);

  useEffect(() => {
    const topLog = logs[0];
    if (!isVisualActionLog(topLog)) {
      return;
    }

    setEffectLog(topLog);
    const timer = window.setTimeout(() => {
      setEffectLog((current) => (current?.logId === topLog.logId ? null : current));
    }, topLog.actionType === "assassinate" ? 1200 : 900);

    return () => window.clearTimeout(timer);
  }, [logs]);

  useEffect(() => {
    console.info("[turn] render tableCards", {
      roomCode,
      tableCardIds: publicTableCards.map((card) => card.cardId)
    });
  }, [publicTableCards, roomCode]);

  useEffect(() => {
    if (!lastCommittedRevealCardIdRef.current) {
      return;
    }

    if (!publicTableCards.some((card) => card.cardId === lastCommittedRevealCardIdRef.current)) {
      console.warn("[turn] selected reveal card missing from public table", {
        roomCode,
        selectedCardId: lastCommittedRevealCardIdRef.current,
        tableCardIds: publicTableCards.map((card) => card.cardId)
      });
    }
  }, [publicTableCards, roomCode]);

  const mePublic = useMemo(
    () => players.find((player) => player.playerId === myPlayerId) ?? null,
    [players, myPlayerId]
  );
  const isHost = room?.hostId === myPlayerId;
  const currentTurnPlayerId = room?.turnOrder[room.currentTurnIndex] ?? null;
  const isMyTurn = currentTurnPlayerId === myPlayerId;

  const availableRestaurantCards = useMemo(
    () =>
      me?.restaurantCards.filter((card) => !card.isRevealed && !card.isDead && !card.isInGraveyard) ?? [],
    [me]
  );

  const hasRestaurantOnTable = useMemo(
    () => Boolean(myPlayerId && publicTableCards.some((card) => card.ownerPlayerId === myPlayerId)),
    [myPlayerId, publicTableCards]
  );

  const hasPlayableRestaurantCard = availableRestaurantCards.length > 0;

  useEffect(() => {
    if (room?.status !== "playing" || !isMyTurn) {
      setRestaurantDeployRequired(false);
      setRestaurantDeploySelectionOpen(false);
      setRestaurantDeployNotice(null);
      return;
    }

    if (!hasRestaurantOnTable && hasPlayableRestaurantCard) {
      // 전장 카드 없음 감지 -> 재배치 필요 상태 진입 -> 식당 카드 선택 레이아웃 재오픈
      setRestaurantDeployRequired(true);
      setRestaurantDeploySelectionOpen(true);
      setRestaurantDeployNotice("전장에 식당 카드가 없어 새 식당 카드를 제출해야 합니다.");
      return;
    }

    setRestaurantDeployRequired(false);
    setRestaurantDeploySelectionOpen(false);
    setRestaurantDeployNotice(null);
  }, [hasPlayableRestaurantCard, hasRestaurantOnTable, isMyTurn, room?.status]);

  async function commitRestaurantDeploy(cardId: string) {
    if (!room) {
      return;
    }

    const selectedCard = me?.restaurantCards.find((card) => card.cardId === cardId);
    if (!selectedCard) {
      console.warn("[turn] selected reveal card missing before deploy commit", { roomCode, cardId });
      return;
    }

    const confirmedCard: RestaurantCard = {
      ...selectedCard,
      isRevealed: true,
      isDead: false,
      isInGraveyard: false
    };

    const nextPublicTableCards = room.tableCards.some((card) => card.cardId === confirmedCard.cardId)
      ? room.tableCards.map((card) => (card.cardId === confirmedCard.cardId ? confirmedCard : card))
      : [...room.tableCards, confirmedCard];

    console.info("[turn] before end turn selected open card", {
      roomCode,
      selectedCardId: cardId
    });

    lastCommittedRevealCardIdRef.current = confirmedCard.cardId;

    // 제출 후 정상 진행:
    // 1. 선택 확정
    // 2. 공개 테이블 반영
    // 3. 임시 상태 정리
    setPublicTableCards(nextPublicTableCards);
    console.info("[turn] after reveal commit tableCards", {
      roomCode,
      tableCardIds: nextPublicTableCards.map((card) => card.cardId)
    });

    await revealNextCard(roomCode, confirmedCard.cardId);
    setRestaurantDeployRequired(false);
    setRestaurantDeploySelectionOpen(false);
    setRestaurantDeployNotice(null);
  }

  function reopenRestaurantDeploySelection() {
    if (!hasPlayableRestaurantCard) {
      return;
    }

    // 전장 카드 없음 감지 -> 재배치 필요 상태 진입 -> 식당 카드 선택 레이아웃 재오픈
    setRestaurantDeployRequired(true);
    setRestaurantDeploySelectionOpen(true);
    setRestaurantDeployNotice("전장에 식당 카드가 없어 새 식당 카드를 제출해야 합니다.");
  }

  async function handleEndTurn() {
    await endTurn(roomCode);
  }

  if (roomConnectState === "error") {
    return (
      <MobileShell title={`방 ${roomCode}`} subtitle="방 상태를 불러오지 못했습니다.">
        <section className="panel error-panel">
          <p>{error ?? "권한 문제 또는 문서 없음으로 방 연결에 실패했습니다."}</p>
          <div className="button-row">
            <button type="button" className="primary-button" onClick={() => void connectToRoom(roomCode)}>
              다시 시도
            </button>
          </div>
        </section>
      </MobileShell>
    );
  }

  if (!room || !mePublic || !draftRules) {
    return (
      <MobileShell title="방 연결 중" subtitle={`방 코드 ${roomCode}`}>
        <section className="panel">
          <p>실시간 방 상태를 불러오는 중입니다.</p>
          {error ? <p className="helper-text">{error}</p> : null}
        </section>
      </MobileShell>
    );
  }

  return (
    <MobileShell
      title={`방 ${roomCode}`}
      subtitle="실시간으로 동기화되는 모바일 카드게임 로비와 플레이 화면입니다."
    >
      {error ? (
        <section className="panel error-panel" onClick={clearError}>
          {error}
        </section>
      ) : null}

      <PlayerList room={room} players={players} myPlayerId={myPlayerId} />

      {room.status === "lobby" ? (
        <>
          <RuleEditor
            isHost={isHost}
            locked={false}
            rules={draftRules}
            onChange={(rules) => {
              setDraftRules(rules);
              void saveRules(roomCode, rules);
            }}
          />
          <RestaurantSubmissionForm
            room={room}
            me={me}
            hasSubmitted={mePublic.hasSubmittedRestaurants}
            onSubmit={(names) => void submitMyRestaurants(roomCode, names)}
          />
          <section className="panel">
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void toggleReady(roomCode, !mePublic.isReady)}
                disabled={!mePublic.hasSubmittedRestaurants}
              >
                {mePublic.isReady ? "READY 해제" : "READY"}
              </button>
              {isHost ? (
                <button type="button" className="primary-button" onClick={() => void startGame(roomCode)}>
                  START
                </button>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {room.status === "reveal_select" && me && !initialRevealConfirmed ? (
        <RevealSelectionPanel
          me={me}
          title="첫 공개 카드 선택"
          actionLabel="첫 공개 카드로 선택"
          confirmed={initialRevealConfirmed}
          onConfirm={(cardId) => {
            setInitialRevealConfirmed(true);
            void selectReveal(roomCode, cardId);
          }}
        />
      ) : null}

      {room.status === "playing" ? (
        <>
          <TurnBanner
            room={room}
            tableCards={publicTableCards}
            players={players}
            me={me}
            myPlayerId={myPlayerId}
            onRequireRestaurantDeploy={reopenRestaurantDeploySelection}
            onEndTurn={handleEndTurn}
          />

          {restaurantDeploySelectionOpen && restaurantDeployRequired && me ? (
            <RevealSelectionPanel
              me={me}
              title="새 식당 카드 제출"
              actionLabel="전장에 올릴 카드로 선택"
              onConfirm={(cardId) => {
                void commitRestaurantDeploy(cardId);
              }}
            />
          ) : null}

          {restaurantDeploySelectionOpen && restaurantDeployNotice ? (
            <section className="panel warning-box">
              {/* 재배치 필요 상태 진입 안내: 막히는 대신 다음 행동 UI와 함께 보여준다. */}
              {restaurantDeployNotice}
            </section>
          ) : null}

          <TableBoard
            tableCards={publicTableCards}
            graveyardCards={room.graveyardCards}
            selectedCardId={selectedTargetCardId}
            effectLog={effectLog}
            allowTableSelection={Boolean(selectedActionType && selectedActionType !== "revive")}
            allowGraveyardSelection={selectedActionType === "revive"}
            onSelectTarget={setSelectedTargetCardId}
          />

          {me ? (
            <ActionHand
              room={room}
              actionCards={me.actionCards}
              targetCardId={selectedTargetCardId}
              onSelectActionType={setSelectedActionType}
              onPickTarget={setSelectedTargetCardId}
              onPlay={(actionId, targetCardId) => {
                setSelectedActionType(null);
                void playAction(roomCode, actionId, targetCardId);
              }}
            />
          ) : null}
        </>
      ) : null}

      {room.status === "finished" ? <FinalCandidatesPanel cards={room.finalCandidates} /> : null}

      <ActionLogPanel logs={logs} />
    </MobileShell>
  );
}
