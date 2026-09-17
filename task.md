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

- [ ] **Release Pipeline (tags + CI)**
    - [ ] **Versioning**: single source of truth in `server/package.json` (`version`), mirrored in `client/package.json`; the Sidebar reads it from a build-time define (`__APP_VERSION__`) instead of the hard-coded `v2.0.0-beta` <!-- id: 38 -->
    - [ ] **Tag scheme**: semver tags `vX.Y.Z` (pre-releases `vX.Y.Z-beta.N`); retire the floating `Release` tag and point the README download link to `releases/latest` <!-- id: 39 -->
    - [ ] **Release script**: `npm run release -- <patch|minor|major>` bumps both `package.json`, updates `CHANGELOG.md`, commits `chore(release): vX.Y.Z` and creates the annotated tag (no push) <!-- id: 40 -->
    - [ ] **CHANGELOG.md**: Keep a Changelog format, one section per tag <!-- id: 41 -->
    - [ ] **CI workflow** (`.github/workflows/ci.yml`, on push/PR): `npm ci` in client + server, client `lint` + `vitest run` + `build`, server `typecheck` + `build` (esbuild bundle) <!-- id: 42 -->
    - [ ] **Release workflow** (`.github/workflows/release.yml`, on `v*` tag push, `windows-latest`): run the CI steps, then `build_exe.bat` equivalent (client build → `server/public` → bundle → `pkg node22-win-x64` → `add_icon`), zip `TwitchWatcher.exe` + `README.md` + `LICENSE` as `TwitchWatcher-vX.Y.Z-win-x64.zip` <!-- id: 43 -->
    - [ ] **GitHub Release**: workflow creates the release from the tag (`softprops/action-gh-release`), body = matching CHANGELOG section, attaches the zip + SHA-256 checksum, marks `-beta` tags as pre-release <!-- id: 44 -->
    - [ ] **Cache & speed**: cache `~/.pkg-cache` (Node 22 binary) and npm caches so a release build stays under ~5 min <!-- id: 45 -->
    - [ ] **Smoke test in CI**: launch the built exe with `NO_BROWSER=1`, poll `GET /api/setup/status` for a `200`, then `POST /api/shutdown` <!-- id: 46 -->
    - [ ] **Docs**: README "Easy Install" points to the latest release; `CLAUDE.md` gains a "Releasing" paragraph (bump → tag → push tag → CI publishes) <!-- id: 47 -->
