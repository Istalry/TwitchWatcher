
> [!NOTE] 
> This project was **Vibe Coded** (built with AI assistance).

> [!WARNING]
> **LIMITATIONS**: This application is running locally on your machine.
> *   **Rate Limits**: It cannot handle massive chat volumes (e.g., thousands of messages per second) due to Twitch API rate limits and local processing power.
> *   **AI Latency**: Local LLM inference (Ollama) depends on your GPU/CPU speed. High chat traffic may cause a backlog in processing.

# TwitchWatcher

**TwitchWatcher** is a local, AI-powered auto-moderation dashboard for Twitch streamers. It serves as an intelligent "second pair of eyes," monitoring your chat in real-time to detect toxicity, hate speech, and spam.

Unlike traditional bots that ban instantly, TwitchWatcher **queues suspicious messages** for human review. This "Human-in-the-Loop" approach prevents AI hallucinations from causing unfair bans while keeping your community safe.

## Key Features
*   **AI Moderation**: Supports **Ollama** (Local, Free) and **Google Gemini** (Cloud, Fast).
*   **Modern Dashboard**: A sleek, dark-mode UI to approve or discard moderation actions.
*   **Network Access**: Control the dashboard from your phone or tablet via local network (QR Code included).
*   **Privacy First**: All chat logs and user data are stored locally on your machine.

---

## 🚀 Installation & Setup

### Option 1: Easy Install (Recommended)
Use this if you just want to run the app without touching code.

1.  **Download** the release zip file: [TwitchWatcher.zip](./TwitchWatcher.zip).
2.  **Extract All** contents to a folder.
3.  **Run** the application:
    *   Double-click `TwitchWatcher.exe` (or the main executable provided).
4.  **Configure**: On first run, go to the **Settings** tab to enter your keys.

### Option 2: Developer Setup (From Source)
Use this if you want to modify the code.

1.  **Prerequisites**: [Node.js](https://nodejs.org/) (v18+).
2.  **Clone the Repository**
    ```bash
    git clone https://github.com/yourusername/TwitchWatcher.git
    cd TwitchWatcher
    ```
3.  **Run Setup**: Double-click `setup.bat`.
4.  **Start App**: Double-click `start_app.bat`.

### 🔑 Getting API Keys

To use this app, you need to create your own API keys. This ensures you have full control and ownership of your bot.

#### 1. Twitch API (Required)
1.  Go to the [Twitch Developer Console](https://dev.twitch.tv/console).
2.  Click **Register Your Application**.
3.  **Name**: TwitchWatcher (or anything you like).
4.  **OAuth Redirect URLs**: `http://localhost:3000/auth/twitch/callback`
5.  **Category**: Chat Bot.
6.  Create it, then copy your **Client ID** and **Client Secret**.

#### 2. Google AI (Optional, for faster/better AI)
1.  Go to [Google AI Studio](https://aistudio.google.com/app/api-keys).
2.  Click **Create API Key**.
3.  Copy the key string (starts with `AIza...`).

---

## 🛡️ Security & API Keys

We take security seriously. Here is how your data is handled:

*   **Encrypted Storage**: Your sensitive credentials (API Keys, Client Secrets) are **encrypted** using **AES-256-GCM** before being written to disk. The decryption key is generated dynamically based on your specific machine, meaning the config file cannot be read if copied to another computer.
*   **Local Only**: Settings are stored in `server/settings.json`.
*   **Git Ignored**: This settings file is explicitly listed in `.gitignore`.
*   **Data Privacy**: Chat logs and user history are also stored in local JSON files. No data is sent to us.

> [!IMPORTANT]
> Never share your `server/settings.json` or `.env` file with anyone.

---

## 💡 How to Use

### The Dashboard
*   **Action Queue**: When the AI flags a message, it appears here. Click **Approve** to punish (Ban/Timeout) or **Discard** to ignore.
*   **Live Users**: See everyone currently chatting. Click a user to view their history or manually ban them.
*   **Settings**: Change AI models, set default timeout duration (e.g., 600s), or clear data.

### Mobile Access (QR Code)
Want to use your iPad or Phone as a moderation deck?
1.  Make sure your PC and Phone are on the same Wi-Fi.
2.  On the dashboard, look for the **Remote Access** button (bottom right).
3.  Scan the **QR Code**.
4.  You now have full control from your mobile device!

---

## 🛠️ Troubleshooting

*   **"App works but AI isn't flagging anything"**: Check your Settings. Ensure you have a valid Model selected (e.g., `gemma:2b` for Ollama).
*   **"Twitch Auth Failed"**: Double-check your Client ID and Secret, and ensure the Redirect URL in Twitch Console matches `http://localhost:3000/auth/twitch/callback`.
