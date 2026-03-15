# 메뉴 밴 카드게임 MVP

스마트폰 브라우저 기준으로 만든 실시간 멀티플레이 웹 카드게임 MVP입니다.

## 1. 기술 스택 추천

### Firebase vs Supabase 짧은 비교

- Firebase
  - Firestore 실시간 구독이 단순하고 모바일 웹 MVP가 빠릅니다.
  - 익명 인증과 GitHub Pages 조합이 쉽습니다.
  - 문서 구조로 공용/비공개 상태를 나누기 편합니다.
- Supabase
  - SQL, RLS, RPC로 서버 권한을 더 강하게 잡기 좋습니다.
  - 대신 MVP 초기 설계량이 더 큽니다.

### 최종 선택

이 프로젝트는 `빠른 실시간 멀티플레이 MVP`, `무료 백엔드`, `정적 프론트 배포`, `닉네임/익명 로그인`이 중요하므로 `Firebase`를 선택했습니다.

- 프론트: `React + TypeScript + Vite`
- 상태관리: `Zustand`
- 백엔드: `Firebase Auth(익명) + Firestore`
- 배포: `GitHub Pages`

## 2. 전체 시스템 구조 설명

```text
rooms/{roomCode}
rooms/{roomCode}/players/{playerId}
rooms/{roomCode}/privatePlayers/{playerId}
rooms/{roomCode}/logs/{logId}
```

- `rooms`
  - 공용 상태
  - 룰, 턴 순서, 공개 테이블 카드, 죽은 카드, 최종 후보
- `players`
  - 공개 플레이어 상태
  - READY, 남은 액션 카드 수, 공개 카드 생존 여부
- `privatePlayers`
  - 개인 비공개 상태
  - 내 식당 카드, 내 액션 카드 상세, 공개 선택 상태
- `logs`
  - 실시간 액션 로그

## 3. 폴더 구조 제안

```text
.
├─ firebase/
│  └─ firestore.rules
├─ src/
│  ├─ components/
│  ├─ lib/
│  ├─ pages/
│  ├─ store/
│  ├─ styles/
│  ├─ types/
│  ├─ App.tsx
│  └─ main.tsx
├─ index.html
├─ package.json
├─ tsconfig.json
├─ tsconfig.node.json
└─ vite.config.ts
```

## 4. 게임 상태 머신 설계

- `lobby`
  - 룰 설정, 식당 카드 제출, READY, START
- `reveal_select`
  - 첫 공개 카드 선택
- `playing`
  - 액션 카드 사용, 죽음/부활, 턴 종료
- `finished`
  - 살아남은 공개 카드만 최종 후보

세부 턴 상태:

- `awaiting_reveal_or_revive`
  - 공개 카드가 없어진 턴 플레이어가 새 카드 공개/부활을 우선 고려
- `action`
  - 액션 카드 사용 가능

## 5. 데이터 모델 설계

핵심 타입은 [src/types/game.ts](/c:/Users/이민석/Documents/vscode_coding/test002/src/types/game.ts) 에 정리했습니다.

- `RoomDoc`
- `RoomRules`
- `PlayerPublic`
- `PlayerPrivate`
- `RestaurantCard`
- `ActionCard`
- `ActionLog`

## 6. 주요 화면 UI 구성

- 홈: 닉네임 입력, 방 생성, 방 코드 입장
- 로비: 룰 설정, 참여자 목록, 식당 카드 제출, READY/START
- 첫 공개: 개인 식당 카드 중 1장 선택
- 플레이: 현재 턴, 공개 카드, 죽은 카드, 액션 카드, 실시간 로그
- 종료: 최종 후보 표시

## 7. 핵심 로직 구현 코드

- 룰 검증: [src/lib/rules.ts](/c:/Users/이민석/Documents/vscode_coding/test002/src/lib/rules.ts)
- 게임 엔진: [src/lib/game-engine.ts](/c:/Users/이민석/Documents/vscode_coding/test002/src/lib/game-engine.ts)
- 실시간 연동: [src/lib/firestore.ts](/c:/Users/이민석/Documents/vscode_coding/test002/src/lib/firestore.ts)
- 상태 저장소: [src/store/useGameStore.ts](/c:/Users/이민석/Documents/vscode_coding/test002/src/store/useGameStore.ts)

## 8. 실시간 동기화 구현

- `onSnapshot()` 으로 `room / players / logs / me-private` 를 동시 구독합니다.
- 액션 처리와 턴 변경은 Firestore 트랜잭션/업데이트로 반영합니다.
- 액션 카드 상세 정보는 `privatePlayers/{myId}` 에만 저장합니다.

MVP에서 안전하게 막는 것:

- 방장만 룰 수정
- 로비에서만 룰 수정
- 룰 범위 검증
- 시작 시 룰 검증 재실행
- 현재 턴 플레이어만 액션 사용
- 죽은 카드 대상 오류 차단
- 사용한 액션 재사용 차단
- 액션 카드 0장이 되면 즉시 종료

MVP 한계:

친구들끼리 플레이하는 수준의 실용적 구조입니다.  
완전한 서버 권한 처리가 필요하면 다음 단계에서 Cloud Functions로 액션 처리 자체를 서버화해야 합니다.

## 9. 로컬 실행 방법

### 1. 설치

```bash
npm install
```

### 2. Firebase 프로젝트 준비

1. Firebase 프로젝트 생성
2. Authentication 에서 `익명 로그인` 활성화
3. Firestore Database 생성
4. `firebase/firestore.rules` 내용 적용

### 3. `.env.local` 생성

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. 개발 서버 실행

```bash
npm run dev
```

## 10. 배포 방법

### GitHub Pages

```bash
npm run build
```

`dist` 를 Pages 브랜치에 배포하면 됩니다.  
Firebase Authentication 허용 도메인에 GitHub Pages 도메인을 등록해야 익명 인증이 정상 동작합니다.

예:

```text
yourname.github.io
```

## 11. 다음 확장 아이디어

- 재접속 복구
- 룰 프리셋 저장
- 최종 메뉴 추첨
- 방장 위임
- 애니메이션
- PWA
- Cloud Functions 기반 서버 권한 처리
