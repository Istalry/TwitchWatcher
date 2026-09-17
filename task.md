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

## Release pipeline (tags + CI)
- [ ] **Versioning**: single source of truth in `server/package.json` (`version`), mirrored in `client/package.json`; the Sidebar reads it from a build-time define (`__APP_VERSION__`) instead of the hard-coded `v2.0.0-beta`
- [ ] **Tag scheme**: semver tags `vX.Y.Z` (pre-releases `vX.Y.Z-beta.N`); retire the floating `Release` tag and point the README download link to `releases/latest`
- [ ] **Release script**: `npm run release -- <patch|minor|major>` bumps both `package.json`, updates `CHANGELOG.md`, commits `chore(release): vX.Y.Z` and creates the annotated tag (no push)
- [ ] **CHANGELOG.md**: Keep a Changelog format, one section per tag
- [ ] **CI workflow** (`.github/workflows/ci.yml`, on push/PR): `npm ci` in client + server, client `lint` + `vitest run` + `build`, server `typecheck` + `build` (esbuild bundle)
- [ ] **Release workflow** (`.github/workflows/release.yml`, on `v*` tag push, `windows-latest`): run the CI steps, then the `build_exe.bat` equivalent (client build → `server/public` → bundle → `pkg node22-win-x64` → `add_icon`), zip `TwitchWatcher.exe` + `README.md` + `LICENSE` as `TwitchWatcher-vX.Y.Z-win-x64.zip`
- [ ] **GitHub Release**: workflow creates the release from the tag (`softprops/action-gh-release`), body = matching CHANGELOG section, attaches the zip + SHA-256 checksum, marks `-beta` tags as pre-release
- [ ] **Cache & speed**: cache `~/.pkg-cache` (Node 22 binary) and npm caches so a release build stays under ~5 min
- [ ] **Smoke test in CI**: launch the built exe with `NO_BROWSER=1`, poll `GET /api/setup/status` for a `200`, then `POST /api/shutdown`
- [ ] **Docs**: README "Easy Install" points to the latest release; `CLAUDE.md` gains a "Releasing" paragraph (bump → tag → push tag → CI publishes)

## Known limitations / ideas
- [ ] YouTube `unban` only works for bans issued in the current session (needs the ban id) — persist `banIds` or look them up via `liveChatBans`
- [ ] Server has no automated tests (stores/services have import side effects) — add a test entry point that avoids the `analysisQueue` interval and file I/O
- [ ] Small models (`gemma3:4b`) over-weight repetition and the literal word "hate" — evaluate a prompt/few-shot set per model, or a larger default model
- [ ] Update README screenshots (`resources/*.png`) to the v2 Moderation tab
