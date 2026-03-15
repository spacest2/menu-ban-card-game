import { PlayerPublic, RoomDoc } from "../types/game";
import { cn } from "../lib/utils";

export function PlayerList(props: {
  room: RoomDoc;
  players: PlayerPublic[];
  myPlayerId: string | null;
}) {
  const currentTurnPlayerId = props.room.turnOrder[props.room.currentTurnIndex];

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>참여자</h2>
          <p>READY, 남은 액션 카드 수, 현재 턴을 한눈에 봅니다.</p>
        </div>
        <strong>{props.players.length}명</strong>
      </div>

      <div className="stack-list">
        {props.players.map((player) => (
          <div
            key={player.playerId}
            className={cn(
              "player-row",
              player.playerId === currentTurnPlayerId && "is-current-turn"
            )}
          >
            <div>
              <strong>
                {player.nickname}
                {player.isHost ? " (방장)" : ""}
                {player.playerId === props.myPlayerId ? " (나)" : ""}
              </strong>
              <p>
                READY {player.isReady ? "완료" : "대기"} / 제출 {player.submittedRestaurantCount}장
              </p>
            </div>
            <div className="player-badges">
              <span>{player.remainingActionCardCount} action</span>
              {player.aliveRevealedCardId ? <span>공개 카드 생존</span> : <span>공개 카드 없음</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
