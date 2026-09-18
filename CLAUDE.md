# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TwitchWatcher is a local, human-in-the-loop AI moderation dashboard for live chat on **Twitch, YouTube and TikTok**. A Node/Express server connects to each enabled platform, merges the chats, runs messages through an LLM (Ollama locally or Google Gemini), and queues flagged messages for a human to approve (timeout/ban via the platform API) or dismiss. A React/Vite SPA is the dashboard. Everything runs on the streamer's machine; the release artifact is a single Windows `.exe`.

## Repository layout

Two independent npm projects with **no workspaces** — the root `package.json` is a stub. Run `npm install` separately in `client/` and `server/`. Node **≥ 20** (tiktok-live-connector requires it).

- `server/` — Express API + platform adapters + AI pipeline. TypeScript compiled as CommonJS (`module: node16`), run with `ts-node` in dev, bundled with esbuild for release.
- `client/` — React 19 + Vite 7 + Tailwind v4 SPA. ESM.
- `*.bat` at root — Windows setup/run/build scripts.
- `project_overview.md`, `code_structure.md`, `design_guidelines.md` — design docs. `design_guidelines.md` has the color palette / typography rules for UI work. `implementation_plan.md` is historical and stale; `task.md` is the project checklist / roadmap. `CHANGELOG.md` is Keep-a-Changelog; new work goes under `[Unreleased]`.
- `scripts/release.mjs` (bump + changelog + tag), `scripts/changelog-section.mjs` (release body), `.github/workflows/{ci,release}.yml`.
- `.claude/launch.json` — `server` and `client` dev-server configs for the Claude browser preview.

## Commands

### Client (`cd client`)
```bash
npm run dev          # Vite dev server on http://localhost:5173 (--host for LAN access); proxies /api and /auth to :3000
npm run build        # tsc -b && vite build → client/dist
npm run lint         # eslint . (clean)
npm test             # vitest in watch mode
npx vitest run       # single run of all tests
npx vitest run src/test/LiveChat.test.tsx   # single test file
```

### Server (`cd server`)
```bash
npm run dev                    # ts-node src/server.ts → http://localhost:3000 (auto-opens a browser)
npm run dev -- --no-browser    # same without opening a browser (also: NO_BROWSER=1); start_app.bat uses this
npm run typecheck              # tsc --noEmit
npm test                       # vitest run — pure-module tests in src/test/ (link detector, settings migration, data-dir migration, version compare)
npm run build                  # typecheck + esbuild bundle → dist/server.cjs (single CJS file)
npm run package                # pkg dist/server.cjs → dist/TwitchWatcher.exe (needs server/public, see build_exe.bat)
npm run icon                   # replace the exe icon with client/public/logo.png (after package)
npm start                      # node dist/server.cjs
```
`DEBUG_AI=1` prints every prompt and raw model response. `NO_UPDATE_CHECK=1` skips the GitHub release check. Server tests must not import the singletons (`settingsStore` is the one exception, and only because `settings.ts` also exports the pure `migrate`/`withDefaults`); `src/scripts/test_encryption.ts` is a manual script.

### Root batch scripts (Windows)
- `setup.bat` — pulls `gemma3:4b` via Ollama (non-fatal), `npm install` in server and client. All credentials are entered in the in-app wizard.
- `start_app.bat` — server dev (`--no-browser`) + client dev in two terminals, opens `:5173`.
- `build_exe.bat` — `client build` → copy `client/dist` → `server/public` → `server build` → `server package` → `server icon` → `server/dist/TwitchWatcher.exe`.

## Two run modes

1. **Packaged / from `server/public`**: the server serves the built client and the SPA calls relative `/api/...` on the same origin. `server/public` is created by `build_exe.bat` (or copy `client/dist` there by hand).
2. **Dev**: Vite on `:5173` proxies `/api` and `/auth` to `:3000` (`client/vite.config.ts`). Hitting `:3000` directly without a `server/public` returns a plain-text hint instead of a crash.

## Server architecture

### Module-level singletons with import side effects
Every store and service exports a ready-made instance (`settingsStore`, `historyStore`, `actionQueue`, `chatHub`, `analysisQueue`, `aiService`, `authService`, `googleAuth`, `platformRegistry`). Importing has side effects: `settingsStore` reads and decrypts `settings.json`, `historyStore` reads `users.json` and registers `SIGINT`/`beforeExit` flush hooks, and `analysisQueue` starts a 500 ms `setInterval` in its constructor. Keep this in mind if you add server tests.

### Data files
`settings.json`, `users.json` and `bans.json` live in `DATA_DIR` (`src/paths.ts`): under `pkg` that is `%APPDATA%\TwitchWatcher` (or the exe folder when a `portable.txt` sits next to the exe), otherwise the server package root (found by walking up to `package.json`, so it works for ts-node, `tsc` output and the esbuild bundle). All are gitignored. `users.json`/`bans.json` writes are debounced (1 s) and flushed on shutdown.

**Updates must never lose user data.** `paths.ts` moves any data file found next to the exe into `DATA_DIR` on first launch (`migrateLegacyDataFiles`, never overwriting). `settingsStore.load()` never clobbers a file it cannot read: it is renamed `settings.json.unreadable-<stamp>` and defaults are used; a schema migration (`schemaVersion`, `migrate()`) writes `settings.json.bak` first. When you change the settings shape, bump `SETTINGS_SCHEMA_VERSION`, add a step to `migrate()` and a case to `src/test/settingsMigrate.test.ts`.

### Settings are the single source of truth
`src/store/settings.ts` owns all config: `platforms.{twitch,youtube,tiktok}` (each with `enabled` + credentials/tokens), `moderation` (sensitivity, category toggles, skipTrustedRoles, `links` policy + `linkAllowlist`), `ai`, `aiLanguage`, `defaultTimeoutDuration`, `checkForUpdates`, `isSetupComplete`, `schemaVersion`. Persisted AES-256-GCM with a key derived from `hostname + OS username`; decrypt failure resets to defaults. `load()` migrates the pre-2.0 Twitch-only layout (`{ twitch: {...} }` → `platforms.twitch`) and fills missing keys from defaults. Setup can complete with **zero** platforms enabled; platforms are added later in Settings, and `PUT /api/settings` reconnects any platform whose config changed.

### Platform adapters (`src/platforms/`)
`types.ts` defines `ChatPlatform` (`connect/disconnect/status/ban/timeout/unban` + `capabilities`) and `IncomingMessage`. `registry.ts` holds the three singletons and `connectAll()`; each adapter no-ops (and disconnects) when its `enabled` flag is off, and retries every 60 s when the channel isn't live.
- `twitch.ts` — tmi.js for chat, Helix `/moderation/bans` for actions (needs both `moderatorId` = token owner and `broadcasterId`). `authService.getToken()` caches `/oauth2/validate` for 5 min; a Helix 401 invalidates and retries once.
- `youtube.ts` — reads chat via **InnerTube** (`youtubei.js`, no key/quota) after resolving the channel's `/live` URL (or `videoIdOverride`); moderates via the **Data API** `liveChatBans` with a Google OAuth token (`services/googleAuth.ts`, scope `youtube.force-ssl`). The Data API can only delete a ban by the id it returned, so ids are persisted in `store/banRegistry.ts` (`bans.json`); `unban` still fails for bans made outside the app. Custom emoji runs render as `:shortcut:`.
- `tiktok.ts` — `tiktok-live-connector` by username; **read-only** (`capabilities` all false). Chat payload fields: `user.id`, `user.displayId`, `user.nickname`, `content`, `common.msgId`.

Both `youtubei.js` and `tiktok-live-connector` are **ESM-only**; the adapters load them with a real dynamic `import()` (preserved by `module: node16`) and use `import('x', { with: { 'resolution-mode': 'import' } })` for types. Don't convert those to static imports.

### Moderation pipeline
```
platform adapter → chatHub.publish(IncomingMessage)
  → historyStore.addMessage (per-user, keyed `${platform}:${userId}`, last 50)
  → analysisQueue.add        (skips broadcaster/moderator roles when skipTrustedRoles)
      link policy `flag`/`block`: services/linkDetector.ts (regex, explicit TLD list, allowlist) → card
      "Link: <domain>" (spam, sev 3, suggestedAction none/timeout) with NO AI call; return
  → 500 ms tick, ≥2 s between AI calls, one user per tick, messages joined with " . "
  → aiService.analyzeMessage → OllamaProvider | GoogleProvider → promptBuilder → JSON verdict
      {flagged, category, severity 1-5, reason, suggestedAction}; normalized in aiService
  → analysisQueue.routeFlag:
      hard floor (sev 5, or hate/threat at sev ≥4)            → queue, always
      category disabled                                        → note
      sev ≥ effectiveMinSeverity (lenient 4 / balanced 3 / strict 2, +1 while flood breaker is on) → queue
      near-miss + ≥2 near-miss notes in 10 min (or ≥3 total)   → queue, reason prefixed "Repeated:"
      otherwise                                                → historyStore.addNote (amber dot in UI)
  → actionQueue.addOrAppend (one pending card per user; keeps last 8 messages / 3 reasons)
  → SSE `/api/chat/stream` pushes `message` and `action` events to the dashboard
  → POST /api/actions/:id/resolve → platform.ban/timeout (resolved only after the call succeeds) | discarded
```
Things that are easy to get wrong:
- **Providers throw; `AIService` fails open** (`flagged:false`) and records `lastError`, surfaced in `/api/status.ai` and the Topbar (amber pill). Don't swallow errors inside a provider.
- **Flood breaker**: rolling window of 50 verdicts; >50 % flagged raises the threshold by 1 until <30 %. Stats are in `/api/status.ai` (`flagRate`, `floodActive`).
- The prompt (`promptBuilder.ts`) is tuned for small models: it lists explicit "ARE / are NOT violations" examples. `gemma3:4b` still over-weights repetition and the literal word "hate"; adjust examples rather than adding more CRITICAL-style instructions, which made it paranoid. When the link policy is not `allow`, the prompt also tells the model that deliberately obfuscated links (`bit(dot)ly`, `discord . gg`) are spam — the regex only catches real URLs.
- Dismiss writes nothing anywhere (the old false-positive store is gone).

### Version and update check
`src/version.ts` reads `server/package.json` (`require`, inlined by esbuild) — the only place the version lives; root `package.json` mirrors it for `npm run release`. `services/updateCheck.ts` asks the GitHub Releases API 10 s after start and daily, compares with `compareVersions()`, and `/api/system/info` exposes `{ version, dataDir, update }`; the Topbar shows a dismissible banner (dismissal per version in `localStorage`).

### API conventions
All routes in `src/server.ts` under `/api/*` plus `/auth/{twitch,youtube}[/callback]`. JSON responses `{ success: true, ... }` or `{ error }`. Users are addressed by URL-encoded key `platform:userId`. `POST /api/setup` and `PUT /api/settings` return `nextAuthUrl` when an enabled platform still needs OAuth; the callbacks chain Twitch → YouTube → `/`. `/api/debug/message` and `/api/debug/flag` take a `platform` and go through the real pipeline (debug flags use role `broadcaster` so the AI doesn't double-flag them).

## Client architecture

- No router. `App.tsx` holds `activeTab` (`moderation | users | debug | settings`) and fetched state; it polls `/api/users` + `/api/status` + `/api/actions` every 2 s and subscribes to the SSE stream through `hooks/useChatStream.ts` (chat messages + instant action-queue updates). `SetupPage` renders until `/api/setup/status` says complete.
- `components/ModerationView.tsx` is the split view (`LiveChat` | queue of `ActionCard`s); below `lg` it becomes a Chat/Queue toggle. `Sidebar` is hidden below `md`; `MobileNav` (same file) is the bottom tab bar.
- `components/platforms/PlatformCards.tsx` — the Twitch/YouTube/TikTok cards used by both the wizard (`mode="setup"`) and Settings (`mode="settings"`, adds status + Connect/Re-authenticate links).
- `platformMeta.ts` holds per-platform label/colors (kept out of `PlatformBadge.tsx` for react-refresh lint). Moderation buttons everywhere are gated on `status.platforms[p].capabilities`.
- **Types are duplicated by hand** between `server/src/store/types.ts` + `settings.ts` and `client/src/types.ts`. Change both.
- Tailwind v4 via `@tailwindcss/postcss`; `tailwind.config.js` adds `primary`, `danger`, `dim`, `dark` colors and `font-inter`. Follow `design_guidelines.md` for new UI.

### Tests
Vitest + jsdom + Testing Library, `globals: true`; `src/test/setup.ts` imports jest-dom and stubs `EventSource`. Tests live in `client/src/test/` with shared builders in `fixtures.ts` (`makeMessage`, `makeAction`, `makeUser`, `platformsAllEnabled`). Components that fetch on mount need `vi.stubGlobal('fetch', ...)` — see `Sidebar.test.tsx`.

## Release build notes
`server/bundle.mjs` (esbuild) flattens the server and the ESM deps into `dist/server.cjs` (defines `import.meta.url` for youtubei.js, externals `bufferutil`/`utf-8-validate`). `npm run package` uses `@yao-pkg/pkg` with target `node22-win-x64` — Node 20 has no prebuilt pkg binary and would try to compile Node from source. `pkg` warnings about `xdg-open` and a dynamic `require` are benign.

### Releasing
1. Put the notes under `[Unreleased]` in `CHANGELOG.md`.
2. `npm run release -- patch|minor|major|x.y.z[-beta.N]` (root): refuses a dirty tree or a branch other than `main`, bumps both `package.json`, rolls the changelog, commits `chore(release): vX.Y.Z` and creates the annotated tag. It never pushes.
3. `git push origin main --follow-tags`. `ci.yml` runs on every push/PR; `release.yml` runs on `v*` tags on `windows-latest`: checks the tag matches the package version, builds client + server, packages the exe, injects the icon, **smoke-tests the exe** (`NO_BROWSER=1`, polls `/api/setup/status`, checks `/api/system/info.version`, `POST /api/shutdown`), zips `TwitchWatcher.exe` + README + LICENSE + CHANGELOG with `SHA256SUMS.txt`, and publishes the GitHub Release with the changelog section as body (`-beta` tags → pre-release). Both lockfiles must stay committed (`npm ci`).
