import { RestaurantCard } from "../types/game";

export function FinalCandidatesPanel(props: { cards: RestaurantCard[] }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>최종 메뉴 후보</h2>
          <p>게임 종료 시점 테이블 위에 살아남은 공개 식당 카드입니다.</p>
        </div>
      </div>
      <div className="card-grid">
        {props.cards.map((card) => (
          <div key={card.cardId} className="restaurant-card result-card">
            <strong>{card.restaurantName}</strong>
            <span>{card.ownerNickname}</span>
            <span>최종 HP {card.hp}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
