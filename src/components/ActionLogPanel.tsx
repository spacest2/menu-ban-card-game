import { ActionLog } from "../types/game";

export function ActionLogPanel(props: { logs: ActionLog[] }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>행동 로그</h2>
          <p>최근 40개의 시스템/행동 기록</p>
        </div>
      </div>

      <div className="log-list">
        {props.logs.map((log) => (
          <div key={log.logId} className="log-item">
            <strong>{new Date(log.timestamp).toLocaleTimeString("ko-KR")}</strong>
            <p>{log.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
