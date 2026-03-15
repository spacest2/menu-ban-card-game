import { useEffect, useState } from "react";
import { PlayerPrivate, RoomDoc } from "../types/game";

export function RestaurantSubmissionForm(props: {
  room: RoomDoc;
  me: PlayerPrivate | null;
  hasSubmitted: boolean;
  onSubmit: (names: string[]) => void;
}) {
  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    setValues(
      Array.from({ length: props.room.rules.restaurantCardCountPerPlayer }, (_, index) =>
        props.me?.restaurantCards[index]?.restaurantName ?? ""
      )
    );
  }, [props.room.rules.restaurantCardCountPerPlayer, props.me?.restaurantCards]);

  const updateValue = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    setValues(next);
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>내 식당 카드 제출</h2>
          <p>이 내용은 본인만 볼 수 있습니다.</p>
        </div>
        {props.hasSubmitted ? <span className="status-pill ready">제출 완료</span> : null}
      </div>

      <div className="stack-list">
        {Array.from({ length: props.room.rules.restaurantCardCountPerPlayer }, (_, index) => (
          <div key={index} className="field">
            <label htmlFor={`restaurant-${index}`}>식당 카드 {index + 1}</label>
            <input
              id={`restaurant-${index}`}
              value={values[index] ?? ""}
              onChange={(event) => updateValue(index, event.target.value)}
              placeholder="예: 교촌치킨 합정점"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        className="primary-button"
        onClick={() => props.onSubmit(values)}
        disabled={values.some((value) => value.trim().length < 1)}
      >
        식당 카드 저장
      </button>
    </section>
  );
}
