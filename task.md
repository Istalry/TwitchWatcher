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
    - [x] Create `ChatUser` Schema & Store (in-memory + JSON sync) <!-- id: 6 -->
    - [x] Implement `users.json` load/save logic <!-- id: 17 -->
    - [x] Create Pending Actions Store (queue) <!-- id: 18 -->
    - [x] Create False Positives Store (learning) <!-- id: 29 -->

- [ ] **Ollama Moderation Engine**
    - [x] Setup Ollama client (model: `gemma3:4b`) <!-- id: 7 -->
    - [x] Create prompt template (including few-shot examples from false positives) <!-- id: 8 -->
    - [x] Implement analysis function <!-- id: 9 -->

- [ ] **Backend API & Core Logic**
    - [x] Setup Express Server <!-- id: 19 -->
    - [x] Implement API: `GET /users`, `GET /users/:id/messages` <!-- id: 20 -->
    - [x] Implement API: `GET /actions`, `POST /actions/:id/resolve` <!-- id: 21 -->
    - [x] Tie chat events to moderation engine (flag -> add to pending queue) <!-- id: 10 -->
    - [x] Implement Ban/Timeout execution logic (triggered via API) <!-- id: 12 -->

- [ ] **Frontend Dashboard (Neo Design)**
    - [x] Setup Vite + React Project <!-- id: 22 -->
    - [x] Create Layout (Dark Mode, Glassmorphism) <!-- id: 23 -->
    - [x] Implement **Action Tab** (Rich Card: Summary, Message, Stats, Actions) <!-- id: 24 -->
    - [x] Implement **Chat Users Tab** (Sortable Table, Detail View with Notes) <!-- id: 25 -->
    - [x] Connect Frontend to Backend (API integration) <!-- id: 26 -->

- [ ] **Verification**
    - [ ] Mock Twitch chat for testing <!-- id: 15 -->
    - [ ] Verify "Discard" flow updates AI context <!-- id: 16 -->
    - [ ] Verify Manual Ban/Timeout flow <!-- id: 27 -->

- [x] **Project Finalization (Setup & Build)**
    - [x] **Unified Settings Store**: Move env vars (Twitch/AI keys) to `settings.json` with runtime updates <!-- id: 30 -->
    - [x] **Dynamic AI Service**: Refactor AI service to support runtime provider switching (Ollama/Google) <!-- id: 31 -->
    - [x] **Secure Setup Flow**:
        - [x] Backend API for Setup/Config <!-- id: 32 -->
        - [x] Frontend Setup Wizard (First launch experience) <!-- id: 33 -->
    - [x] **Advanced Settings Page**:
        - [x] AI Provider/Model Switcher <!-- id: 34 -->
        - [x] Secure Field Component (Masked + Warning Modal) <!-- id: 35 -->
    - [x] **Build System**:
        - [x] Configure `pkg` for single-file executable <!-- id: 36 -->
        - [x] Create final build script <!-- id: 37 -->
