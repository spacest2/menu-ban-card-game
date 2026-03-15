import { useMemo, useState } from "react";
import { ACTION_LABELS, MAX_ACTIONS_PER_TURN } from "../lib/constants";
import { ActionCard, ActionType, RestaurantCard, RoomDoc } from "../types/game";
import { cn } from "../lib/utils";

export function ActionHand(props: {
  room: RoomDoc;
  actionCards: ActionCard[];
  targetCardId: string | null;
  onSelectActionType?: (type: ActionType | null) => void;
  onPickTarget: (cardId: string | null) => void;
  onPlay: (actionId: string, targetCardId: string) => void;
}) {
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const selectedAction = useMemo(
    () => props.actionCards.find((card) => card.actionId === selectedActionId) ?? null,
    [props.actionCards, selectedActionId]
  );

  const availableCards = props.actionCards.filter((card) => !card.used);
  const candidateTargets: RestaurantCard[] =
    selectedAction?.type === "revive" ? props.room.graveyardCards : props.room.tableCards;

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>내 액션 카드</h2>
          <p>한 턴 최대 {MAX_ACTIONS_PER_TURN}장 사용 가능</p>
        </div>
        <strong>{availableCards.length}장 남음</strong>
      </div>

      <div className="card-grid compact-grid action-cards">
        {availableCards.map((card) => (
          <button
            key={card.actionId}
            type="button"
            className={cn("action-chip", selectedActionId === card.actionId && "selected-card")}
            onClick={() => {
              setSelectedActionId(card.actionId);
              props.onSelectActionType?.(card.type);
              props.onPickTarget(null);
            }}
          >
            {ACTION_LABELS[card.type]}
          </button>
        ))}
      </div>

      {selectedAction ? (
        <div className="stack-list">
          <p className="helper-text">
            대상 선택: {selectedAction.type === "revive" ? "죽은 카드" : "살아 있는 공개 카드"}
          </p>
          <div className="card-grid compact-grid action-targets">
            {candidateTargets.map((card) => (
              <button
                key={card.cardId}
                type="button"
                className={cn("target-pill", props.targetCardId === card.cardId && "selected-card")}
                onClick={() => props.onPickTarget(card.cardId)}
              >
                {card.restaurantName}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={!props.targetCardId}
            onClick={() => {
              if (!props.targetCardId) return;
              props.onPlay(selectedAction.actionId, props.targetCardId);
              setSelectedActionId(null);
              props.onSelectActionType?.(null);
              props.onPickTarget(null);
            }}
          >
            선택한 액션 사용
          </button>
        </div>
      ) : null}
    </section>
  );
}
