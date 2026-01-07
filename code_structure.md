# Code Structure & Development Guidelines

## Architecture Overview
The project is a monorepo consisting of two distinct parts:
1.  **Server (`/server`)**: A Node.js API that handles Twitch connections, AI processing, and data persistence.
2.  **Client (`/client`)**: A React Single Page Application (SPA) that acts as the user interface.

## Directory Structure

### Server (`/server`)
```
src/
├── services/       # External integrations (Twitch, Auth)
│   ├── twitchClient.ts  # TMI.js bot logic
│   └── authService.ts   # OAuth flow handlers
├── store/          # In-memory databases
│   ├── actionQueue.ts   # Pending moderation actions
│   ├── history.ts       # Chat user history
│   └── settings.ts      # App configuration
├── scripts/        # Utility scripts (e.g., token generation)
├── config.ts       # Environment variables & constants
└── server.ts       # Main Express application & API routes
```

### Client (`/client`)
```
src/
├── components/     # Reusable UI blocks
│   ├── ActionCard.tsx   # The main moderation card
│   ├── Sidebar.tsx      # Navigation
│   └── ...
├── styles/         # Global styles
│   └── neo.css          # Neo-brutalism variable definitions
├── types.ts        # Shared TypeScript interfaces
├── App.tsx         # Main layout & routing logic
└── main.tsx        # Entry point
```

## Guidelines

### TypeScript
- **Strict Typing**: Avoid `any`. Define interfaces in `types.ts` (Client) or interface files (Server) for shared data structures.
- **Async/Await**: Use async/await over promises for cleaner readable code.

### State Management
- **Server**: Uses in-memory Singletons (Classes with static instances or exported instances) for state. This is simple and effective for a local app.
    - *Note*: If the app restarts, state is lost. This is intentional for now.
- **Client**: Uses React `useState` and `useEffect` for data fetching.
    - **Polling**: The client polls the server (`/api/actions`, `/api/users`) every few seconds. There is no websocket connection yet.

### API Standards
- **REST**: Use standard HTTP methods.
    - `GET` for retrieving data.
    - `POST` for modifying state (resolving actions, sending debug messages).
    - `DELETE` for removing resources.
- **Responses**: Always return JSON.
    - Success: `{ success: true, data: ... }`
    - Error: `{ error: "Description" }` (Status 4xx/5xx).

### Adding Features
1.  **Backend First**: Implement the logic in `server/src/store` or `server/src/services`.
2.  **Expose API**: Add a route in `server/src/server.ts`.
3.  **Frontend**: Create a component in `client/src/components` and hook it up in `App.tsx`.
