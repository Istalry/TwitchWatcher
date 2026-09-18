# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.1.0] - 2026-09-18

### Changed
- Link policy is now *Allow* / *Suppress* (delete message + timeout) / *Ban* (delete message + ban). The card explains what approval does; nothing happens until the streamer confirms. Existing *Flag* / *Block* settings become *Suppress*.

### Added
- `deleteMessage` platform capability (Twitch Helix, YouTube Data API); link cards delete the offending message(s) on approval.
- **Log tab**: every timeout, ban, unban and message deletion is journaled in `sanctions.json` (who, why, AI / link / rule / manual, streamer or auto) with an **Undo** button that lifts the ban or timeout.
- **Rules**: deterministic rules evaluated before the AI (banned words/phrases, regular expression, caps lock, repeated message), each with its own category, sanction and "delete message" flag. Rule hits become cards without an AI call.
- **Auto mode** (off by default): a rule or the link policy can execute its sanction automatically after a grace period (10 s by default) shown as a countdown on the card, with **Hold** to keep the card for a manual decision. AI verdicts are never executed automatically.
- **User-log retention**: users inactive for 90 days (configurable, 0 = keep forever) are purged at startup and daily; banned users are kept. "Purge now" in Settings → General.
- **Settings backup**: export all settings (including API keys and OAuth tokens) to a password-encrypted `.twbackup` file and import it on any machine.
- AI prompt bench (`npm run bench:ai`) with an English + French labelled dataset; providers and the prompt builder accept overrides so a model can be evaluated without touching the settings.
- Server tests for the moderation pipeline (routing, flood breaker, analysis queue, rules, auto executor, sanction log, retention, backup).

### Changed
- New installs default to the *Suppress* link policy and ship with an enabled *Repeated message* rule (3× within 60 s → delete + timeout, confirmed by the streamer). Existing settings are not changed.
- The moderation prompt lists French casual uses of "tue"/"mort", untargeted swearing and "selling followers" among its examples.
- README screenshots redone for the Moderation tab, Live Users, the setup wizard, plus new ones for the Log tab and the rules editor.

### Fixed
- On desktop the tab content started under the top bar (the panel headers were hidden behind it).
- `POST /api/actions/:id/resolve` and the manual moderation route share one sanction path, so message deletion, user status and the journal stay consistent.

## [2.0.0] - 2026-09-18

### Added
- Multi-platform chat: Twitch, YouTube (InnerTube read + Data API bans with Google OAuth) and TikTok (read-only), merged into one live feed.
- Moderation tab: split view with the merged live chat next to the action queue; Chat/Queue toggle and bottom navigation on phones.
- Structured AI verdicts (category + severity), sensitivity levels, category toggles, per-user notes for borderline flags, escalation on repeated near-misses, one coalesced card per user, flood breaker.
- Link policy: plain URLs are caught instantly (allow / flag / block with an allowlist); disguised links are left to the AI.
- Setup wizard with skippable platform step; platforms can be enabled later in Settings without a restart.
- Update check against GitHub Releases with a dismissible banner (can be turned off in Settings).
- Data folder moved to `%APPDATA%\TwitchWatcher`; files found next to the exe are migrated automatically. `portable.txt` keeps them next to the exe.
- YouTube bans issued from the dashboard are remembered in `bans.json` so they can be lifted after a restart.
- Server unit tests (vitest) and a CI / release pipeline.

### Changed
- AI failures are surfaced in the top bar instead of silently failing open.
- `users.json` writes are debounced; Twitch token validation is cached.
- An unreadable `settings.json` is set aside (`settings.json.unreadable-*`) instead of being overwritten; migrations keep a `settings.json.bak`.

### Removed
- The false-positive learning loop; Dismiss now only clears the card.
- The `.env` configuration path.

[Unreleased]: https://github.com/Istalry/TwitchWatcher/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/Istalry/TwitchWatcher/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Istalry/TwitchWatcher/releases/tag/v2.0.0
