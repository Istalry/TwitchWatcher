# TwitchWatcher - Project Overview

## Goal
TwitchWatcher is a local, AI-powered auto-moderation dashboard designed for Twitch streamers. It acts as an intelligent "second pair of eyes" that monitors chat in real-time, detecting potential toxicity, hate speech, or spam using a local LLM (Ollama). Instead of banning users immediately, it queues suspicious messages for human review, preventing AI hallucinations from causing unfair bans.

## Key Functionality

### 1. AI-Powered Moderation
- **Real-time Monitoring**: Connects to Twitch Chat via TMI.js.
- **Local Analysis**: Messages are analyzed locally using Ollama (default model: `gemma2:2b` or similar), ensuring privacy and no external API costs.
- **Context Awareness**: The AI takes into account recent chat context to make better judgments.
- **False Positive Learning**: Users can "discard" flagged actions, teaching the system (in-session) to ignore similar patterns.

### 2. The Moderation Dashboard
- **Action Queue**: One-click interface to `Approve` (Ban/Timeout) or `Discard` flagged messages.
- **Live User History**: Tracks all active users in chat, their message history, and their current status (Active, Banned, Timed Out).
- **Manual Control**: Moderators can manually issue timeouts or bans from the user list, independent of AI flags.

### 3. Safety & Control
- **Human-in-the-Loop**: The AI only *suggests* bans/timeouts; a human must approve them (unless configured for full auto, currently designed for review).
- **Debug Console**: Built-in tools to simulate "troll" messages and force-flag scenarios to test system limits without needing actual chat activity.
- **Secure Auth**: Uses Twitch OAuth 2.0 flow for secure connection to the channel.

## Tech Stack Strategy
- **Client**: React (Vite) for a snappy, single-page application experience.
- **Server**: Node.js + Express for robust API handling and websocket-like polling.
- **AI**: Ollama for local inference.
- **Design**: "Neo-Brutalism" aesthetic – high contrast, bold typography, and fluid animations for a premium feel.
