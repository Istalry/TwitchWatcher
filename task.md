# Twitch Auto-Moderator with Ollama

- [ ] **Project Setup**
    - [ ] Initialize Node.js TypeScript project <!-- id: 0 -->
    - [ ] Install dependencies (`tmi.js`, `ollama` (or axios), `dotenv`) <!-- id: 1 -->
    - [ ] Create configuration structure (env vars for keys, config file for settings) <!-- id: 2 -->
- [ ] **Twitch Integration**
    - [ ] Implement Twitch Chat Client connection <!-- id: 3 -->
    - [ ] Implement event listeners (message, connect) <!-- id: 4 -->
    - [ ] Implement Ban/Timeout actions <!-- id: 5 -->
- [ ] **Data Management & Persistence**
    - [ ] Create `ChatUser` Schema & Store (in-memory + JSON sync) <!-- id: 6 -->
    - [ ] Implement `users.json` load/save logic <!-- id: 17 -->
    - [ ] Create Pending Actions Store (queue) <!-- id: 18 -->
    - [ ] Create False Positives Store (learning) <!-- id: 29 -->

- [ ] **Ollama Moderation Engine**
    - [ ] Setup Ollama client (model: `gemma3:4b`) <!-- id: 7 -->
    - [ ] Create prompt template (including few-shot examples from false positives) <!-- id: 8 -->
    - [ ] Implement analysis function <!-- id: 9 -->

- [ ] **Backend API & Core Logic**
    - [ ] Setup Express Server <!-- id: 19 -->
    - [ ] Implement API: `GET /users`, `GET /users/:id/messages` <!-- id: 20 -->
    - [ ] Implement API: `GET /actions`, `POST /actions/:id/resolve` <!-- id: 21 -->
    - [ ] Tie chat events to moderation engine (flag -> add to pending queue) <!-- id: 10 -->
    - [ ] Implement Ban/Timeout execution logic (triggered via API) <!-- id: 12 -->

- [ ] **Frontend Dashboard (Neo Design)**
    - [ ] Setup Vite + React Project <!-- id: 22 -->
    - [ ] Create Layout (Dark Mode, Glassmorphism) <!-- id: 23 -->
    - [ ] Implement **Action Tab** (Rich Card: Summary, Message, Stats, Actions) <!-- id: 24 -->
    - [ ] Implement **Chat Users Tab** (Sortable Table, Detail View with Notes) <!-- id: 25 -->
    - [ ] Connect Frontend to Backend (API integration) <!-- id: 26 -->

- [ ] **Verification**
    - [ ] Mock Twitch chat for testing <!-- id: 15 -->
    - [ ] Verify "Discard" flow updates AI context <!-- id: 16 -->
    - [ ] Verify Manual Ban/Timeout flow <!-- id: 27 -->
