# TwitchWatcher — Project Checklist

Done items are kept as a record of what exists; unchecked items are the roadmap.

## v1 — Twitch auto-moderator (done)
- [x] Node/TypeScript server (Express) + React/Vite dashboard
- [x] Twitch chat via `tmi.js`, ban/timeout via Helix, Twitch OAuth
- [x] Ollama moderation engine (`gemma3:4b`) with Google Gemini as alternative provider
- [x] Persistent user history (`users.json`), pending-action queue, human-in-the-loop resolve API
- [x] Dashboard: Action cards, Chat Users tab with detail view, Settings, Debug tools
- [x] Setup wizard, encrypted `settings.json` (AES-256-GCM, machine-bound), runtime provider switching
- [x] Network access + QR code pairing
- [x] Single-file Windows executable (`pkg`)

## v2 — Multi-platform + moderation tuning (done)
- [x] Platform adapter layer (`server/src/platforms`): Twitch, YouTube (InnerTube read + Data API bans, Google OAuth), TikTok (read-only)
- [x] `chatHub` + SSE stream (`/api/chat/stream`) replacing action polling
- [x] Settings `platforms.{twitch,youtube,tiktok}` with enable flags; migration of v1 `settings.json` / `users.json`
- [x] Wizard: Welcome → Platforms (skippable) → AI; platforms configurable later in Settings with hot reconnect
- [x] Moderation tab: merged live chat | action queue split view, Chat/Queue toggle and bottom nav on phones
- [x] Structured verdicts (category + severity), sensitivity levels, category toggles, hard floor for hate/threat
- [x] Below-threshold notes, repeat escalation, one coalesced card per user, trusted roles skipped, flood breaker
- [x] AI failures surfaced in the Topbar; debounced `users.json` writes; cached Twitch token validation
- [x] Removed false-positive learning loop, `.env` config path and dead scripts
- [x] esbuild bundle → `dist/server.cjs`, `pkg node22-win-x64`, data files next to the exe
- [x] Client tests (vitest + Testing Library): ActionCard, Sidebar, UserList, LiveChat, ModerationView, NetworkQRCode
- [x] Docs: `CLAUDE.md`, README, `project_overview.md`, `code_structure.md`

## Release pipeline (tags + CI) (done)
- [x] **Versioning**: `server/package.json` is the single source (`src/version.ts`, inlined by esbuild); root `package.json` mirrors it; the Sidebar shows the version from `/api/system/info`
- [x] **Tag scheme**: semver tags `vX.Y.Z` (pre-releases `vX.Y.Z-beta.N`); README points to `releases/latest`
- [x] **Release script**: `npm run release -- <patch|minor|major|x.y.z>` bumps, rolls `CHANGELOG.md`, commits and tags (never pushes)
- [x] **CHANGELOG.md** in Keep a Changelog format
- [x] **CI workflow** (`.github/workflows/ci.yml`): client lint + tests + build, server tests + bundle
- [x] **Release workflow** (`.github/workflows/release.yml`, on `v*` tags, `windows-latest`): build → pkg → icon → smoke test of the exe → zip + SHA-256 → GitHub Release with the changelog section (`-beta` = pre-release)
- [x] **Cache**: npm + `~/.pkg-cache`
- [x] **Docs**: README "Updating" section, `CLAUDE.md` "Releasing"
- [ ] Manual, once `v2.0.0` is published: delete the old floating `Release` tag/release on GitHub

## Update-safe data (done)
- [x] Data files in `%APPDATA%\TwitchWatcher` (packaged); files next to the exe are moved there on first launch; `portable.txt` keeps the old behaviour
- [x] Unreadable `settings.json` is set aside (`.unreadable-<stamp>`) instead of overwritten; `schemaVersion` + `settings.json.bak` on migration
- [x] Update check against GitHub Releases (daily, opt-out in Settings → General) with a Topbar banner; data folder shown in Settings

## Link blocking (done)
- [x] Setting `moderation.links: allow | suppress | ban` + `linkAllowlist` (parent domains cover subdomains); trusted roles exempt
- [x] Deterministic pass (`services/linkDetector.ts`, explicit TLD list, IPv4) before the AI → card `Link: <domain>` (spam, sev 3), no AI call; approval deletes the message and times out (`suppress`) or bans (`ban`) the user — the streamer always confirms
- [x] Obfuscated links (`bit(dot)ly`, `discord . gg`) → prompt clause under spam, with a version-number counter-example
- [x] Settings UI (mode + allowlist), server + client tests

## Known limitations / ideas
- [ ] Server tests cover only pure modules; the pipeline (`analysisQueue`, stores) still has import side effects that make it hard to test
- [ ] Small models (`gemma3:4b`) over-weight repetition and the literal word "hate" — evaluate a prompt/few-shot set per model, or a larger default model
- [ ] Update README screenshots (`resources/*.png`) to the v2 Moderation tab
