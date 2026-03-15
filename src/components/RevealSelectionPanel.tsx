import { useEffect, useMemo, useState } from "react";
import { PlayerPrivate } from "../types/game";
import { cn } from "../lib/utils";

export function RevealSelectionPanel(props: {
  me: PlayerPrivate;
  title: string;
  actionLabel: string;
  confirmed?: boolean;
  onConfirm: (cardId: string) => void;
}) {
  const unrevealed = useMemo(
    () => props.me.restaurantCards.filter((card) => !card.isRevealed),
    [props.me.restaurantCards]
  );
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  useEffect(() => {
    if (props.confirmed || unrevealed.length === 0) {
      setSelectedCardId(null);
      return;
    }

    if (!selectedCardId || !unrevealed.some((card) => card.cardId === selectedCardId)) {
      setSelectedCardId(unrevealed[0]?.cardId ?? null);
    }
  }, [props.confirmed, selectedCardId, unrevealed]);

  // 최초 공개 카드가 확정되면 이 선택 단계는 완전히 종료한다.
  if (props.confirmed) {
    return null;
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>{props.title}</h2>
          <p>카드를 먼저 고른 뒤 선택완료 버튼으로 1회만 확정합니다.</p>
        </div>
      </div>

      <div className="card-grid">
        {unrevealed.map((card) => (
          <button
            key={card.cardId}
            type="button"
            className={cn(
              "restaurant-card",
              "reveal-pick-card",
              selectedCardId === card.cardId && "selected-card"
            )}
            onClick={() => setSelectedCardId(card.cardId)}
            disabled={props.confirmed}
          >
            <span className="pick-card-glow" />
            {selectedCardId === card.cardId ? <span className="selection-badge">선택됨</span> : null}
            <strong>{card.restaurantName}</strong>
            <span>{props.actionLabel}</span>
            <span className="helper-text">
              {selectedCardId === card.cardId ? "선택완료 버튼으로 확정" : "클릭해서 선택"}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="primary-button"
        disabled={!selectedCardId || props.confirmed}
        onClick={() => {
          if (!selectedCardId || props.confirmed) return;
          props.onConfirm(selectedCardId);
          setSelectedCardId(null);
        }}
      >
        선택완료
      </button>
    </section>
  );
}
