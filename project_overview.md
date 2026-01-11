# TwitchWatcher - Project Overview

## Goal
TwitchWatcher is a local, AI-powered auto-moderation dashboard designed for Twitch streamers. It acts as an intelligent "second pair of eyes" that monitors chat in real-time, detecting potential toxicity, hate speech, or spam using a local LLM (Ollama) or Cloud AI (Google Gemini). Instead of banning users immediately, it queues suspicious messages for human review, preventing AI hallucinations from causing unfair bans.

## Key Functionality

### 1. AI-Powered Moderation
- **Real-time Monitoring**: Connects to Twitch Chat via TMI.js.
- **Flexible AI Providers**: Supports both local inference via **Ollama** (privacy-focused, free) and cloud inference via **Google Gemini** (higher performance).
- **Unified Logic**: Uses a consistent, tunable prompt system (via `promptBuilder`) to detect harassment and insults, taking into account recent chat context.
- **False Positive Learning**: Users can "discard" flagged actions, teaching the system (in-session) to ignore similar patterns.

### 2. The Moderation Dashboard
- **Modern UI**: A responsive, Neo-Brutalism inspired dashboard with a sidebar and topbar for easy navigation.
- **Action Queue**: One-click interface to `Approve` (Ban/Timeout) or `Discard` flagged messages.
- **Live User Tracking**:
    - Tracks all active users in chat.
    - View aggressive history and message logs.
    - Sort by activity or search for specific users.
- **Settings & Configuration**:
    - **AI Configuration**: Switch providers, models, and set the AI system language.
    - **Sanctions**: Customize default timeout duration.
    - **Data Management**: One-click option to clear all user data or delete specific user history.

### 3. Connectivity & Access
- **Network Access**: Launch with `--host` to access the dashboard from any device on your local network.
- **QR Code Pairing**: Built-in QR code generator for instant mobile access—perfect for using a phone or tablet as a dedicated moderation deck.

### 4. Safety & Control
- **Human-in-the-Loop**: The AI only *suggests* bans/timeouts; a human must approve them.
- **Secure Auth**: Full Twitch OAuth 2.0 integration ensuring secure and authorized implementation of moderation actions (bans/timeouts) as the broadcaster or a moderator.
- **Debug Console**: Tools to simulate chat traffic and test AI limits.

## Tech Stack Strategy
- **Client**: React (Vite) + TailwindCSS.
- **Server**: Node.js + Express (API & WebSocket-like polling).
- **AI**: Ollama (Local) / Google Gemini (Cloud).
- **Design**: "Neo-Brutalism" aesthetic – high contrast, bold typography, and fluid animations.
