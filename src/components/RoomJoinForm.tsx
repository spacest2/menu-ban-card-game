import { FormEvent } from "react";

export function RoomJoinForm(props: {
  nickname: string;
  roomCode: string;
  loading: boolean;
  authReady?: boolean;
  onNicknameChange: (value: string) => void;
  onRoomCodeChange: (value: string) => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    props.onJoin();
  };

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="nickname">닉네임</label>
        <input
          id="nickname"
          value={props.nickname}
          onChange={(event) => props.onNicknameChange(event.target.value)}
          placeholder="예: 민석"
          maxLength={12}
        />
      </div>
      <div className="field">
        <label htmlFor="room-code">방 코드</label>
        <input
          id="room-code"
          value={props.roomCode}
          onChange={(event) => props.onRoomCodeChange(event.target.value)}
          placeholder="6자리 코드"
          maxLength={6}
        />
      </div>
      <div className="button-row">
        <button
          className="primary-button"
          type="button"
          disabled={!props.authReady || props.loading || props.nickname.trim().length < 1}
          onClick={props.onCreate}
        >
          방 만들기
        </button>
        <button
          className="secondary-button"
          type="submit"
          disabled={
            !props.authReady ||
            props.loading ||
            props.nickname.trim().length < 1 ||
            props.roomCode.trim().length < 4
          }
        >
          방 입장
        </button>
      </div>
    </form>
  );
}
