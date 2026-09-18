# TwitchWatcher - Project Overview

## Goal
TwitchWatcher is a local, AI-powered auto-moderation dashboard for live streamers on Twitch, YouTube and TikTok. It acts as an intelligent "second pair of eyes" that watches all enabled chats in one merged feed, detecting potential toxicity, hate speech, threats or spam using a local LLM (Ollama) or Cloud AI (Google Gemini). Instead of banning users immediately, it queues suspicious messages for human review, preventing AI hallucinations from causing unfair bans.

## Key Functionality

### 1. AI-Powered Moderation
- **Real-time Monitoring**: Twitch (tmi.js), YouTube (InnerTube) and TikTok (tiktok-live-connector) chats merged into one feed.
- **Flexible AI Providers**: Supports both local inference via **Ollama** (privacy-focused, free) and cloud inference via **Google Gemini** (higher performance).
- **Structured Verdicts**: The prompt (`promptBuilder`) asks for a category and a 1-5 severity, taking the user's recent messages into account.
- **Over-flagging Mitigation**: A sensitivity threshold and category toggles decide what becomes a card; borderline flags become *notes* on the user, repeated near-misses escalate, slurs/threats always reach the queue, and a flood breaker raises the threshold when the model starts flagging everything.
- **Link Policy**: Plain URLs are caught deterministically (allow / suppress = delete + timeout / ban = delete + ban, with an allowlist) without an AI call and always confirmed by the streamer; the AI is only asked about deliberately disguised links.
- **Deterministic Rules**: The streamer's own filters (banned words, regex, caps lock, repeated messages) run before the AI and produce cards with a chosen category, sanction and delete flag.
- **Opt-in Auto Mode**: A rule or the link policy can execute its sanction after a grace period shown as a countdown on the card (Hold / Dismiss cancel it). AI verdicts are never executed automatically.
- **Prompt Bench**: A labelled English + French dataset and `npm run bench:ai` measure precision / recall of a model + prompt before changing either.

### 2. The Moderation Dashboard
- **Modern UI**: A responsive, Neo-Brutalism inspired dashboard with a sidebar and topbar for easy navigation (bottom tab bar on phones).
- **Moderation Split View**: Merged live chat on the left with flagged messages highlighted inline and hover quick-actions; the action queue on the right with one-click `Timeout` / `Ban` / `Dismiss`. TikTok cards are review-only (no moderation API).
- **Live User Tracking**:
    - Tracks all active users across platforms.
    - View message history and the AI's below-threshold notes.
    - Sort by activity or search for specific users.
    - Inactive users are purged after a configurable retention period (banned users are kept).
- **Sanction Log**: Every timeout, ban, unban and deletion is journaled with its source (AI, link, rule, manual) and author (streamer or auto) and can be undone from the Log tab.
- **Settings & Configuration**:
    - **Moderation**: Sensitivity (lenient/balanced/strict), category toggles, skip broadcaster/moderators, link policy, rules, auto mode.
    - **Platforms**: Enable/configure Twitch, YouTube, TikTok at any time; OAuth connect buttons.
    - **AI Configuration**: Switch providers, models, and set the AI system language.
    - **Sanctions**: Customize default timeout duration.
    - **Data Management**: One-click option to clear all user data or delete specific user history.
    - **General**: Update check against GitHub Releases (opt-out), the location of the data folder (`%APPDATA%\TwitchWatcher`, kept across updates), user-log retention and a password-encrypted settings backup (export / import, restorable on another machine).

### 3. Connectivity & Access
- **Network Access**: Launch with `--host` to access the dashboard from any device on your local network.
- **QR Code Pairing**: Built-in QR code generator for instant mobile access—perfect for using a phone or tablet as a dedicated moderation deck.

### 4. Safety & Control
- **Human-in-the-Loop**: The AI only *suggests* bans/timeouts; a human must approve them. Automatic execution exists only for the streamer's own deterministic rules, is off by default and can be stopped during its countdown.
- **Secure Auth**: Twitch OAuth 2.0 and Google OAuth 2.0 (YouTube Data API) for authorized moderation actions as the broadcaster or a moderator.
- **Debug Console**: Tools to simulate chat traffic and test AI limits.

## Tech Stack Strategy
- **Client**: React (Vite) + TailwindCSS.
- **Server**: Node.js + Express (REST API + Server-Sent Events for the live feed).
- **AI**: Ollama (Local) / Google Gemini (Cloud).
- **Design**: "Neo-Brutalism" aesthetic – high contrast, bold typography, and fluid animations.
