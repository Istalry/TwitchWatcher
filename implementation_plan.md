# Twitch Auto-Moderator Implementation Plan

This app will list locally, connecting to Twitch chat and using a local Ollama instance (`gemma3:4b`) to flag content. **Crucially, it requires human verification before banning.**

## User Review Required
> [!IMPORTANT]
> **Prerequisites**:
> 1.  **Ollama**: `ollama pull gemma3:4b`
> 2.  **Twitch Credits**: OAuth, Username, Channel.
> 3.  **Runtime**: Node.js and a Browser (Chrome/Edge/Firefox).

> [!NOTE]
> **Running the App**:
> I will add a script so you just run `npm start`. This will:
> 1. Start the Backend API & Twitch Client.
> 2. Start the Frontend Dashboard.
> 3. Automatically open your default browser to `http://localhost:3000`.

## Proposed Changes

### Architecture: Client-Server
-   **Backend**: Node.js (Express) + `tmi.js` + `ollama`.
    -   Handles Chat connection.
    -   Runs Analysis.
    -   Stores Chat History (RAM).
    -   Maintains a "Pending Review Payload" queue.
    -   Maintains a "False Positive" list (JSON file) to feed back into the AI.
-   **Frontend**: React (Vite) + Vanilla CSS.
    -   **Style**: Neo Design (Dark Mode, Glassmorphism, Neon Accents).
    -   **Tabs**:
        -   **Action Tab**: Cards for flagged messages. "Approve" (with options) or "Discard".
        -   **Chat Users Tab**: List of active users. Click to see their last 50 messages.

### Directory Structure
```
twitch-automod/
├── server/
│   ├── src/
│   │   ├── config.ts
│   │   ├── services/
│   │   │   ├── twitchClient.ts      # Listen to chat
│   │   │   ├── ollamaService.ts     # Analyze + Retrain logic (Context injection)
│   │   │   └── actionQueue.ts       # Manage pending approvals
│   │   ├── store/
│   │   │   ├── history.ts           # Map<User, Msg[]>
│   │   │   └── falsePositives.json  # Persisted learning
│   │   └── server.ts                # Express API
├── client/                          # React App
│   ├── src/
│   │   ├── components/
│   │   │   ├── ActionCard.tsx       # The "Popup"
│   │   │   ├── UserList.tsx
│   │   │   └── Layout.tsx           # Neo Design Wrapper
│   │   ├── App.tsx
│   │   └── styles/
│   │       └── neo.css              # Custom Neo Dark CSS
├── package.json                     # Workspaces or single repo
└── README.md
```

### workflows

#### 1. The Moderation Loop
1.  **Ingest**: User sends message.
2.  **History**: Msg added to `history.ts` (Last 50).
3.  **Analyze**:
    -   Construct Prompt: "Here are examples of benign messages: [FalsePositives]. Analyze this new message: [Msg]."
    -   Role: "Twitch Mod". Output: `{ flagged: boolean, reason: string, suggested_action: string }`.
4.  **Flagging**:
    -   If `!flagged` -> Do nothing.
    -   If `flagged` -> **Do NOT Ban**. Create a `PendingAction` object.
5.  **Review (Frontend)**:
    -   User sees card in "Action Tab".
    -   **Option A: Discard**:
        -   Backend adds message to `falsePositives.json`.
        -   Future prompts will include this as a "safelist" example.
    -   **Option B: Modify/Confirm**:
        -   User selects "Ban Duration" (Dropdown: 10m, 1d, 1w, Perm).
        -   Click "Execute".
        -   Backend sends `/ban` or `/timeout` to Twitch.

#### 2. The Dashboard (Neo Design)
-   **Dark Mode**: Deep gray/black backgrounds (`#1a1a1a`).
-   **Actions**: "Popups" (Cards) with glowing borders (Red for severe).
-   **Typography**: Clean sans-serif (Inter/SF Pro).

## Verification Plan

### Automated Tests
-   Test `history` truncation (50 limit).
-   Test `FalsePositive` injection (ensure the prompt string includes previous discarded items).

### Manual Verification
-   **Setup**: Run `npm start`.
-   **Chat Test**: Type a bad message in mock/real chat.
-   **UI Check**: Verify "Action Tab" shows the card.
-   **Discard Flow**: Click Discard. Type same message again -> AI should (ideally) be less likely to flag it, or at least it's saved.
-   **Ban Flow**: Click "Confirm" -> Verify `tmi.js` calls the ban command.
