# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- Link policy is now *Allow* / *Suppress* (delete message + timeout) / *Ban* (delete message + ban). The card explains what approval does; nothing happens until the streamer confirms. Existing *Flag* / *Block* settings become *Suppress*.

### Added
- `deleteMessage` platform capability (Twitch Helix, YouTube Data API); link cards delete the offending message(s) on approval.

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

[Unreleased]: https://github.com/Istalry/TwitchWatcher/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/Istalry/TwitchWatcher/releases/tag/v2.0.0
