import { useMemo } from "react";
import { ACTION_LABELS, DEFAULT_RULES } from "../lib/constants";
import { clamp } from "../lib/utils";
import { getRulesWarnings, totalActionCards } from "../lib/rules";
import { RoomRules } from "../types/game";

const ACTION_KEYS = Object.keys(DEFAULT_RULES.actionCardConfig) as Array<
  keyof typeof DEFAULT_RULES.actionCardConfig
>;

function Stepper(props: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="stepper-row">
      <span>{props.label}</span>
      <div className="stepper">
        <button type="button" disabled={props.disabled} onClick={() => props.onChange(props.value - 1)}>
          -
        </button>
        <strong>{props.value}</strong>
        <button type="button" disabled={props.disabled} onClick={() => props.onChange(props.value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

export function RuleEditor(props: {
  isHost: boolean;
  locked: boolean;
  rules: RoomRules;
  onChange: (rules: RoomRules) => void;
}) {
  const warnings = useMemo(() => getRulesWarnings(props.rules), [props.rules]);
  const disabled = !props.isHost || props.locked;

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>방장 룰 설정</h2>
          <p>로비에서만 변경 가능하며 시작 시 확정됩니다.</p>
        </div>
        <button
          type="button"
          className="ghost-button"
          disabled={disabled}
          onClick={() => props.onChange(DEFAULT_RULES)}
        >
          기본값 복구
        </button>
      </div>

      <Stepper
        label="플레이어당 식당 카드"
        value={props.rules.restaurantCardCountPerPlayer}
        disabled={disabled}
        onChange={(value) =>
          props.onChange({
            ...props.rules,
            restaurantCardCountPerPlayer: clamp(value, 1, 5)
          })
        }
      />

      <div className="rule-grid">
        {ACTION_KEYS.map((key) => (
          <Stepper
            key={key}
            label={ACTION_LABELS[key]}
            value={props.rules.actionCardConfig[key]}
            disabled={disabled}
            onChange={(value) =>
              props.onChange({
                ...props.rules,
                actionCardConfig: {
                  ...props.rules.actionCardConfig,
                  [key]: clamp(value, 0, 5)
                }
              })
            }
          />
        ))}
      </div>

      <div className="info-strip">
        <span>예상 총 액션 카드 수</span>
        <strong>{totalActionCards(props.rules.actionCardConfig)}</strong>
      </div>
      <div className="info-strip">
        <span>플레이어 1인당 식당 카드 수</span>
        <strong>{props.rules.restaurantCardCountPerPlayer}</strong>
      </div>

      {warnings.length > 0 ? (
        <div className="warning-box">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
