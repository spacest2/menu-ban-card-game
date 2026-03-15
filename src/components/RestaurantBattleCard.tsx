import { type CSSProperties, type Ref, useEffect, useMemo, useState } from "react";
import { ActionLog, RestaurantCard } from "../types/game";
import { cn } from "../lib/utils";
import { ReviveEffect } from "./ReviveEffect";

type CardEffectTone = "attack" | "assassinate" | "heal" | "revive" | null;

function useAnimatedNumber(value: number) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (displayValue === value) {
      return;
    }

    const diff = value - displayValue;
    const step = diff > 0 ? 1 : -1;
    const timer = window.setInterval(() => {
      setDisplayValue((current) => {
        if (current === value) {
          window.clearInterval(timer);
          return current;
        }

        const next = current + step;
        if ((step > 0 && next > value) || (step < 0 && next < value)) {
          window.clearInterval(timer);
          return value;
        }
        return next;
      });
    }, 45);

    return () => window.clearInterval(timer);
  }, [displayValue, value]);

  return displayValue;
}

export function RestaurantBattleCard(props: {
  card: RestaurantCard;
  selected?: boolean;
  isClickable?: boolean;
  tone?: "alive" | "dead";
  transientState?: "assassinate_effect" | "attack_death_exit";
  effectLog?: ActionLog | null;
  onClick?: () => void;
  cardRef?: Ref<HTMLButtonElement>;
  className?: string;
  style?: CSSProperties;
}) {
  const [effectKey, setEffectKey] = useState(0);
  const animatedHp = useAnimatedNumber(props.card.hp);

  const effectTone = useMemo<CardEffectTone>(() => {
    if (!props.effectLog || props.effectLog.targetCardId !== props.card.cardId) {
      return null;
    }

    if (props.effectLog.actionType === "assassinate") return "assassinate";
    if (props.effectLog.actionType === "revive") return "revive";
    if (props.effectLog.actionType === "attack2" || props.effectLog.actionType === "attack3" || props.effectLog.actionType === "attack5") {
      return "attack";
    }
    if (props.effectLog.actionType === "heal2" || props.effectLog.actionType === "heal3" || props.effectLog.actionType === "heal5") {
      return "heal";
    }
    return null;
  }, [props.card.cardId, props.effectLog]);

  const isAssassinateGhost =
    effectTone === "assassinate" &&
    props.effectLog?.targetCardId === props.card.cardId &&
    props.card.isDead &&
    !props.card.isInGraveyard;

  const isAttackDeathGhost =
    props.transientState === "attack_death_exit" &&
    props.card.isDead &&
    !props.card.isInGraveyard;

  useEffect(() => {
    if (!effectTone) return;
    setEffectKey((current) => current + 1);
  }, [effectTone, props.effectLog?.logId]);

  const floatingText = useMemo(() => {
    if (!props.effectLog || props.effectLog.targetCardId !== props.card.cardId) {
      return null;
    }
    if (effectTone === "attack") return `-${props.effectLog.value ?? ""}`;
    if (effectTone === "heal") return `+${props.effectLog.value ?? ""}`;
    if (effectTone === "assassinate") return "암살..";
    return null;
  }, [effectTone, props.card.cardId, props.effectLog]);

  return (
    <button
      ref={props.cardRef}
      type="button"
      className={cn(
        "restaurant-card",
        "battle-card",
        props.className,
        props.tone === "dead" && "dead-card",
        props.selected && "selected-card",
        props.isClickable ? "clickable-card" : "disabled-card",
        effectTone === "attack" && `card-hit-${effectKey}`,
        effectTone === "heal" && `card-heal-${effectKey}`,
        effectTone === "assassinate" && `card-assassinate-${effectKey}`,
        effectTone === "revive" && `card-revive-${effectKey}`,
        isAssassinateGhost && "assassinate-ghost-card",
        isAttackDeathGhost && "attack-death-card"
      )}
      style={props.style}
      onClick={props.onClick}
      disabled={!props.isClickable}
    >
      <div className="card-chrome" />
      <div className="card-topline">
        <span className="owner-badge">{props.card.ownerNickname}</span>
        <span className={cn("hp-badge", animatedHp > props.card.baseHp && "hp-boosted")}>
          HP {animatedHp}
        </span>
      </div>

      <div className="card-title-block">
        <strong>{props.card.restaurantName}</strong>
        <span>{props.tone === "dead" ? "죽은 카드" : "공개 카드"}</span>
      </div>

      <div className="card-footer">
        <span className="card-mini-stat">Base {props.card.baseHp}</span>
        <span className={cn("status-dot", props.tone === "dead" ? "status-dead" : "status-alive")} />
      </div>

      {effectTone ? <span className={cn("card-impact-overlay", `overlay-${effectTone}`)} /> : null}
      {effectTone === "assassinate" ? <span className="card-slash-overlay" /> : null}
      {effectTone === "heal" ? <span className="card-aura-overlay" /> : null}
      <ReviveEffect triggerId={props.effectLog?.logId ?? null} active={effectTone === "revive"} />
      {isAttackDeathGhost ? <span className="kill-badge">Kill</span> : null}
      {floatingText ? (
        <span key={`${props.effectLog?.logId}-${effectTone}`} className={cn("floating-effect", effectTone && `float-${effectTone}`)}>
          {floatingText}
        </span>
      ) : null}
    </button>
  );
}
