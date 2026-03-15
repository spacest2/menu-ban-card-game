import { PlayerPrivate, PlayerPublic, RestaurantCard, RoomDoc } from "../types/game";

type TurnEndValidationResult =
  | { mode: "block"; message: string }
  | { mode: "notify_then_continue"; message: string }
  | { mode: "continue" };

export function TurnBanner(props: {
  room: RoomDoc;
  tableCards: RestaurantCard[];
  players: PlayerPublic[];
  me: PlayerPrivate | null;
  myPlayerId: string | null;
  onRequireRestaurantDeploy: () => void;
  onEndTurn: () => Promise<void> | void;
}) {
  const currentPlayerId = props.room.turnOrder[props.room.currentTurnIndex];
  const currentPlayer = props.players.find((player) => player.playerId === currentPlayerId) ?? null;
  const isMyTurn = currentPlayerId === props.myPlayerId;

  function hasRestaurantOnTable(playerId: string) {
    return props.tableCards.some((card) => card.ownerPlayerId === playerId);
  }

  function hasPlayableRestaurantCard(playerId: string) {
    if (props.me?.playerId !== playerId) {
      return false;
    }

    return props.me.restaurantCards.some(
      (card) => !card.isRevealed && !card.isDead && !card.isInGraveyard
    );
  }

  function validateTurnEnd(playerId: string): TurnEndValidationResult {
    const alreadyOnTable = hasRestaurantOnTable(playerId);
    if (alreadyOnTable) {
      return { mode: "continue" };
    }

    const canPlayRestaurantCard = hasPlayableRestaurantCard(playerId);
    if (canPlayRestaurantCard) {
      return {
        mode: "block",
        message: "전장에 식당 카드가 없어 새 식당 카드를 제출해야 합니다."
      };
    }

    return {
      mode: "notify_then_continue",
      message: "보유중인 식당카드가 없으므로 액션카드만 사용 가능합니다"
    };
  }

  async function handleEndTurn() {
    if (!props.myPlayerId) {
      return;
    }

    const validation = validateTurnEnd(props.myPlayerId);
    if (validation.mode === "block") {
      // 전장 카드 없음 감지 -> 재배치 필요 상태 진입을 상위에서 처리한다.
      window.alert(validation.message);
      props.onRequireRestaurantDeploy();
      return;
    }

    if (validation.mode === "notify_then_continue") {
      window.alert(validation.message);
    }

    await props.onEndTurn();
  }

  return (
    <section className="panel accent-panel">
      <div className="section-heading">
        <div>
          <h2>현재 턴</h2>
          <p>
            {currentPlayer ? `${currentPlayer.nickname} 차례` : "플레이어 정보 없음"} / 사용한 액션{" "}
            {props.room.cardsPlayedThisTurn}장
          </p>
        </div>
        {isMyTurn ? <span className="status-pill ready">내 차례</span> : null}
      </div>

      {isMyTurn ? (
        <button type="button" className="secondary-button" onClick={() => void handleEndTurn()}>
          턴종료
        </button>
      ) : null}
    </section>
  );
}
