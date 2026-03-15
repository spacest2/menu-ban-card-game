import { useEffect, useRef, useState } from "react";
import { ActionLog, RestaurantCard } from "../types/game";
import { cn } from "../lib/utils";
import { RestaurantBattleCard } from "./RestaurantBattleCard";

interface AnimatedCard extends RestaurantCard {
  transientState?: "assassinate_effect" | "attack_death_exit";
}

interface RectSnapshot {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface AssassinationSlideState {
  card: AnimatedCard;
  from: RectSnapshot;
  to: RectSnapshot;
  phase: "idle" | "moving";
}

const ASSASSINATE_EFFECT_DURATION_MS = 850;
const ASSASSINATE_SLIDE_DURATION_MS = 560;
const ATTACK_DEATH_DURATION_MS = 900;

export function TableBoard(props: {
  tableCards: RestaurantCard[];
  graveyardCards: RestaurantCard[];
  selectedCardId: string | null;
  effectLog?: ActionLog | null;
  allowTableSelection?: boolean;
  allowGraveyardSelection?: boolean;
  onSelectTarget?: (cardId: string) => void;
}) {
  const [displayedTableCards, setDisplayedTableCards] = useState<AnimatedCard[]>(props.tableCards);
  const [hiddenGraveyardCardId, setHiddenGraveyardCardId] = useState<string | null>(null);
  const [assassinationSlide, setAssassinationSlide] = useState<AssassinationSlideState | null>(null);
  const processedAssassinateLogIdRef = useRef<string | null>(null);
  const processedAttackDeathLogIdRef = useRef<string | null>(null);
  const activeAssassinateCardIdRef = useRef<string | null>(null);
  const displayedTableCardsRef = useRef<AnimatedCard[]>(props.tableCards);
  const assassinateAnimationRunningRef = useRef(false);
  const timerIdsRef = useRef<number[]>([]);
  const tableCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const graveyardCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const attackKillSequencesRef = useRef<Record<string, number>>({});
  const attackKillTimeoutsRef = useRef<Record<string, number>>({});
  const effectLog = props.effectLog ?? null;

  useEffect(() => {
    displayedTableCardsRef.current = displayedTableCards;
  }, [displayedTableCards]);

  useEffect(() => {
    return () => {
      for (const timerId of timerIdsRef.current) {
        window.clearTimeout(timerId);
      }
      for (const timerId of Object.values(attackKillTimeoutsRef.current)) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  const scheduleDelay = (delayMs: number) =>
    new Promise<void>((resolve) => {
      const timerId = window.setTimeout(() => {
        timerIdsRef.current = timerIdsRef.current.filter((value) => value !== timerId);
        resolve();
      }, delayMs);
      timerIdsRef.current.push(timerId);
    });

  function resetCardVisualState(cardId: string) {
    const elements = [tableCardRefs.current[cardId], graveyardCardRefs.current[cardId]].filter(Boolean);

    for (const element of elements) {
      element?.classList.remove("attack-death-card", "card-ghost-hidden");
      element?.style.removeProperty("opacity");
      element?.style.removeProperty("visibility");
      element?.style.removeProperty("display");
      element?.style.removeProperty("transform");
      element?.style.removeProperty("filter");
    }
  }

  function isCardStillDead(cardId: string, killSequenceId: number) {
    const latestSequenceId = attackKillSequencesRef.current[cardId];
    const stillInGraveyard = props.graveyardCards.some((card) => card.cardId === cardId);
    const revivedOnTable = props.tableCards.some((card) => card.cardId === cardId && !card.isDead);
    const stillDead = latestSequenceId === killSequenceId && stillInGraveyard && !revivedOnTable;

    console.info("[kill] finalize check", {
      cardId,
      killSequenceId,
      latestSequenceId,
      stillInGraveyard,
      revivedOnTable,
      stillDead
    });

    return stillDead;
  }

  function startKillAnimation(cardId: string) {
    const nextSequenceId = (attackKillSequencesRef.current[cardId] ?? 0) + 1;
    attackKillSequencesRef.current[cardId] = nextSequenceId;

    console.info("[kill] sequence start", { cardId, killSequenceId: nextSequenceId });

    return nextSequenceId;
  }

  function finalizeKilledCard(cardId: string, killSequenceId: number) {
    // 죽음 후처리: 카드가 아직도 같은 킬 시퀀스에서 죽은 상태일 때만 숨김 정리를 계속한다.
    if (!isCardStillDead(cardId, killSequenceId)) {
      return;
    }

    setDisplayedTableCards(props.tableCards);
  }

  function cancelKillSequence(cardId: string) {
    const pendingTimeout = attackKillTimeoutsRef.current[cardId];
    if (pendingTimeout) {
      window.clearTimeout(pendingTimeout);
      delete attackKillTimeoutsRef.current[cardId];
    }

    if (attackKillSequencesRef.current[cardId]) {
      attackKillSequencesRef.current[cardId] += 1;
    }

    console.info("[kill] revive cancel", {
      cardId,
      killSequenceCancelled: true,
      killSequenceId: attackKillSequencesRef.current[cardId] ?? null
    });
  }

  function reviveCard(cardId: string) {
    // 부활 시 죽음 후처리 무효화 -> 전장 복귀 후 시각 상태 초기화
    cancelKillSequence(cardId);
    resetCardVisualState(cardId);

    window.requestAnimationFrame(() => {
      const element = tableCardRefs.current[cardId];
      if (!element) {
        return;
      }

      const computed = window.getComputedStyle(element);
      console.info("[kill] revive visual state", {
        cardId,
        className: element.className,
        opacity: computed.opacity,
        visibility: computed.visibility
      });
    });
  }

  useEffect(() => {
    if (assassinateAnimationRunningRef.current) {
      const activeCardId = activeAssassinateCardIdRef.current;
      const animatedCard = displayedTableCardsRef.current.find((card) => card.cardId === activeCardId);
      setDisplayedTableCards(animatedCard ? [...props.tableCards, animatedCard] : props.tableCards);
      return;
    }

    setDisplayedTableCards(props.tableCards);
  }, [props.tableCards]);

  useEffect(() => {
    for (const card of props.tableCards) {
      if (!card.isDead) {
        reviveCard(card.cardId);
      }
    }
  }, [props.tableCards]);

  useEffect(() => {
    if (
      effectLog?.actionType !== "assassinate" ||
      !effectLog.targetCardId ||
      processedAssassinateLogIdRef.current === effectLog.logId ||
      props.tableCards.some((card) => card.cardId === effectLog.targetCardId)
    ) {
      return undefined;
    }

    const targetCardId = effectLog.targetCardId;
    const existingCard = displayedTableCardsRef.current.find((card) => card.cardId === targetCardId);
    const fallbackCard = props.graveyardCards.find((card) => card.cardId === targetCardId);
    const sourceCard = existingCard ?? fallbackCard;

    if (!sourceCard) {
      setDisplayedTableCards(props.tableCards);
      return undefined;
    }

    const stagedCard: AnimatedCard = {
      ...sourceCard,
      transientState: "assassinate_effect",
      isDead: true,
      isInGraveyard: false
    };

    processedAssassinateLogIdRef.current = effectLog.logId;
    assassinateAnimationRunningRef.current = true;
    activeAssassinateCardIdRef.current = targetCardId;
    setHiddenGraveyardCardId(targetCardId);
    setDisplayedTableCards([
      ...props.tableCards.filter((card) => card.cardId !== targetCardId),
      stagedCard
    ]);

    void (async () => {
      await scheduleDelay(ASSASSINATE_EFFECT_DURATION_MS);

      const sourceElement = tableCardRefs.current[targetCardId];
      const targetElement = graveyardCardRefs.current[targetCardId];

      if (sourceElement && targetElement) {
        setAssassinationSlide({
          card: stagedCard,
          from: toRectSnapshot(sourceElement.getBoundingClientRect()),
          to: toRectSnapshot(targetElement.getBoundingClientRect()),
          phase: "idle"
        });
        setDisplayedTableCards((current) => current.filter((card) => card.cardId !== targetCardId));

        await scheduleDelay(18);
        setAssassinationSlide((current) => (current ? { ...current, phase: "moving" } : current));
        await scheduleDelay(ASSASSINATE_SLIDE_DURATION_MS);
      }

      setAssassinationSlide(null);
      setHiddenGraveyardCardId(null);
      assassinateAnimationRunningRef.current = false;
      activeAssassinateCardIdRef.current = null;
      setDisplayedTableCards(props.tableCards);
    })();

    return undefined;
  }, [effectLog, props.graveyardCards, props.tableCards]);

  useEffect(() => {
    const isAttackDeathEvent =
      (effectLog?.actionType === "attack2" ||
        effectLog?.actionType === "attack3" ||
        effectLog?.actionType === "attack5") &&
      Boolean(effectLog?.targetCardId) &&
      !props.tableCards.some((card) => card.cardId === effectLog?.targetCardId) &&
      props.graveyardCards.some((card) => card.cardId === effectLog?.targetCardId);

    if (!isAttackDeathEvent || !effectLog?.targetCardId) {
      return undefined;
    }

    if (processedAttackDeathLogIdRef.current === effectLog.logId) {
      return undefined;
    }

    const targetCardId = effectLog.targetCardId;
    const killSequenceId = startKillAnimation(targetCardId);
    processedAttackDeathLogIdRef.current = effectLog.logId;

    setDisplayedTableCards((current) => {
      const existing = current.find((card) => card.cardId === targetCardId);
      if (existing) {
        return current.map((card) =>
          card.cardId === targetCardId
            ? { ...card, transientState: "attack_death_exit", isDead: true, isInGraveyard: false }
            : card
        );
      }

      const fallback = props.graveyardCards.find((card) => card.cardId === targetCardId);
      if (!fallback) {
        return props.tableCards;
      }

      return [
        ...props.tableCards,
        { ...fallback, transientState: "attack_death_exit", isInGraveyard: false, isDead: true }
      ];
    });

    const timerId = window.setTimeout(() => {
      delete attackKillTimeoutsRef.current[targetCardId];
      finalizeKilledCard(targetCardId, killSequenceId);
    }, ATTACK_DEATH_DURATION_MS);

    attackKillTimeoutsRef.current[targetCardId] = timerId;

    return () => {
      if (attackKillTimeoutsRef.current[targetCardId] === timerId) {
        window.clearTimeout(timerId);
        delete attackKillTimeoutsRef.current[targetCardId];
      }
    };
  }, [effectLog, props.graveyardCards, props.tableCards]);

  const visibleTableCards = displayedTableCards.filter(
    (card) =>
      card.transientState === "assassinate_effect" ||
      card.transientState === "attack_death_exit" ||
      !card.isInGraveyard
  );

  return (
    <div className="table-board-stack">
      {/* 제목 변경 / 전장 강조 스타일: 메인 전투 공간을 별도 클래스와 비주얼로 강조한다. */}
      <section className="panel battlefield-panel">
        <div className="section-heading">
          <div>
            <h2 className="battlefield-title">전장</h2>
            <p>현재 공개되어 전투 중인 식당 카드입니다.</p>
          </div>
          <strong>{visibleTableCards.length}장</strong>
        </div>
        <div className="card-grid">
          {visibleTableCards.map((card) => (
            <RestaurantBattleCard
              key={card.cardId}
              card={card}
              cardRef={(node) => {
                tableCardRefs.current[card.cardId] = node;
              }}
              effectLog={props.effectLog}
              selected={props.selectedCardId === card.cardId}
              transientState={card.transientState}
              tone={
                card.transientState === "assassinate_effect" || card.transientState === "attack_death_exit"
                  ? "alive"
                  : undefined
              }
              isClickable={Boolean(props.onSelectTarget && props.allowTableSelection)}
              onClick={
                props.onSelectTarget && props.allowTableSelection
                  ? () => props.onSelectTarget?.(card.cardId)
                  : undefined
              }
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>죽은 카드 목록</h2>
            <p>쓰러진 카드가 정착하는 영역입니다.</p>
          </div>
          <strong>{props.graveyardCards.length}장</strong>
        </div>
        <div className="card-grid">
          {props.graveyardCards.map((card) => (
            <RestaurantBattleCard
              key={card.cardId}
              card={card}
              cardRef={(node) => {
                graveyardCardRefs.current[card.cardId] = node;
              }}
              effectLog={props.effectLog}
              tone="dead"
              className={cn(card.cardId === hiddenGraveyardCardId && "card-ghost-hidden")}
              selected={props.selectedCardId === card.cardId}
              isClickable={Boolean(props.onSelectTarget && props.allowGraveyardSelection)}
              onClick={
                props.onSelectTarget && props.allowGraveyardSelection
                  ? () => props.onSelectTarget?.(card.cardId)
                  : undefined
              }
            />
          ))}
        </div>
      </section>

      {assassinationSlide ? (
        <RestaurantBattleCard
          card={assassinationSlide.card}
          tone="dead"
          className={cn(
            "assassinate-slide-clone",
            assassinationSlide.phase === "moving" && "is-moving"
          )}
          style={{
            top:
              assassinationSlide.phase === "moving"
                ? assassinationSlide.to.top
                : assassinationSlide.from.top,
            left:
              assassinationSlide.phase === "moving"
                ? assassinationSlide.to.left
                : assassinationSlide.from.left,
            width:
              assassinationSlide.phase === "moving"
                ? assassinationSlide.to.width
                : assassinationSlide.from.width,
            height:
              assassinationSlide.phase === "moving"
                ? assassinationSlide.to.height
                : assassinationSlide.from.height
          }}
        />
      ) : null}
    </div>
  );
}

function toRectSnapshot(rect: DOMRect): RectSnapshot {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height
  };
}
