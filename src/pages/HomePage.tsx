import { MobileShell } from "../components/MobileShell";
import { RoomJoinForm } from "../components/RoomJoinForm";
import { useGameStore } from "../store/useGameStore";

export function HomePage() {
  const {
    authReady,
    loading,
    error,
    nicknameDraft,
    roomInput,
    setNicknameDraft,
    setRoomInput,
    createRoom,
    joinRoom,
    clearError
  } = useGameStore();

  return (
    <MobileShell
      title="메뉴 밴 카드게임"
      subtitle="친구들과 방 코드를 공유하고, 식당 후보를 카드 배틀처럼 남겨서 최종 메뉴를 고르는 모바일 우선 웹앱입니다."
    >
      {!authReady ? <section className="panel">익명 로그인 준비 중...</section> : null}
      {error ? (
        <section className="panel error-panel" onClick={clearError}>
          {error}
        </section>
      ) : null}
      <RoomJoinForm
        nickname={nicknameDraft}
        roomCode={roomInput}
        loading={loading}
        authReady={authReady}
        onNicknameChange={setNicknameDraft}
        onRoomCodeChange={setRoomInput}
        onCreate={() => void createRoom(nicknameDraft.trim())}
        onJoin={() => void joinRoom(roomInput.trim().toUpperCase(), nicknameDraft.trim())}
      />
    </MobileShell>
  );
}
