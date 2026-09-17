# Code Structure & Development Guidelines

## Architecture Overview
The project is a monorepo consisting of two distinct parts:
1.  **Server (`/server`)**: A Node.js API that handles the platform connections (Twitch, YouTube, TikTok), AI processing, and data persistence.
2.  **Client (`/client`)**: A React Single Page Application (SPA) that acts as the user interface.

## Directory Structure

### Server (`/server`)
```
src/
├── platforms/      # One adapter per chat platform, all implementing ChatPlatform
│   ├── types.ts         # ChatPlatform interface, IncomingMessage, capabilities
│   ├── registry.ts      # The three adapter singletons + connectAll()
│   ├── twitch.ts        # tmi.js chat + Helix bans
│   ├── youtube.ts       # InnerTube chat (youtubei.js) + Data API bans
│   └── tiktok.ts        # tiktok-live-connector, read-only
├── services/
│   ├── chatHub.ts       # Single entry point for messages → history, analysis, SSE fan-out
│   ├── analysisQueue.ts # Batching, rate limit, routing of AI verdicts (queue vs. note)
│   ├── authService.ts   # Twitch OAuth
│   ├── googleAuth.ts    # Google OAuth (YouTube Data API)
│   └── ai/              # AIService (fail-open + lastError), providers, promptBuilder
├── store/          # In-memory state, some persisted to JSON
│   ├── actionQueue.ts   # Pending moderation actions (EventEmitter)
│   ├── history.ts       # Chat users, messages and AI notes (users.json)
│   ├── settings.ts      # Encrypted app configuration (settings.json)
│   └── types.ts         # Shared domain types
├── paths.ts        # Where settings.json / users.json live (exe dir or server root)
└── server.ts       # Express application & API routes (incl. SSE stream)
```

### Client (`/client`)
```
src/
├── components/
│   ├── ModerationView.tsx  # Split view: LiveChat | action queue
│   ├── LiveChat.tsx        # Merged multi-platform feed with inline flags & quick actions
│   ├── ActionCard.tsx      # The moderation card
│   ├── PlatformBadge.tsx   # TW / YT / TT badge
│   ├── platforms/          # Twitch/YouTube/TikTok config cards (wizard + settings)
│   ├── Sidebar.tsx         # Desktop nav + MobileNav bottom bar
│   └── ...
├── hooks/useChatStream.ts  # SSE subscription (/api/chat/stream)
├── platformMeta.ts         # Per-platform labels/colors
├── styles/neo.css          # Neo-brutalism variable definitions
├── types.ts                # TypeScript interfaces (hand-synced with the server)
├── App.tsx                 # Main layout & tab logic
└── main.tsx                # Entry point
```

## Guidelines

### TypeScript
- **Strict Typing**: Avoid `any`. Define interfaces in `types.ts` (Client) or `store/types.ts` (Server) for shared data structures, and keep the two in sync.
- **Async/Await**: Use async/await over promises for cleaner readable code.

### State Management
- **Server**: Uses in-memory Singletons (exported instances) for state. The action queue is lost on restart by design; users/notes and settings are persisted.
- **Client**: Uses React `useState` and `useEffect`.
    - **Push**: chat messages and action-queue changes arrive over Server-Sent Events (`/api/chat/stream`).
    - **Polling**: users and system status are polled every 2 seconds.

### API Standards
- **REST**: Use standard HTTP methods.
    - `GET` for retrieving data.
    - `POST` for modifying state (resolving actions, sending debug messages).
    - `PUT` for settings.
    - `DELETE` for removing resources.
- **Responses**: Always return JSON.
    - Success: `{ success: true, data: ... }`
    - Error: `{ error: "Description" }` (Status 4xx/5xx).
- Users are addressed by their key `platform:userId` (URL-encoded).

### Adding a Platform
1.  Implement `ChatPlatform` in `server/src/platforms/<name>.ts`; publish messages through `chatHub.publish()` and declare honest `capabilities`.
2.  Register it in `platforms/registry.ts`, add its settings shape to `store/settings.ts` and `store/types.ts` (`Platform` union).
3.  Client: add it to `types.ts`, `platformMeta.ts`, and a config card in `components/platforms/PlatformCards.tsx`; wire the card into `SetupPage` and `Settings`.

### Adding Features
1.  **Backend First**: Implement the logic in `server/src/store`, `services` or `platforms`.
2.  **Expose API**: Add a route in `server/src/server.ts`.
3.  **Frontend**: Create a component in `client/src/components` and hook it up in `App.tsx`.
