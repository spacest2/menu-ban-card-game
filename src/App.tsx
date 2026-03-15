import { useEffect, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { RoomPage } from "./pages/RoomPage";
import { useGameStore } from "./store/useGameStore";

function getRoomCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("room");
}

export default function App() {
  const [roomCode, setRoomCode] = useState<string | null>(() => getRoomCodeFromUrl());
  const bootstrap = useGameStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const syncRoomCode = () => {
      setRoomCode(getRoomCodeFromUrl());
    };

    window.addEventListener("popstate", syncRoomCode);
    window.addEventListener("codex:navigation", syncRoomCode);

    return () => {
      window.removeEventListener("popstate", syncRoomCode);
      window.removeEventListener("codex:navigation", syncRoomCode);
    };
  }, []);

  return roomCode ? <RoomPage roomCode={roomCode.toUpperCase()} /> : <HomePage />;
}
