import dotenv from 'dotenv';
dotenv.config();

export const config = {
    twitch: {
        username: process.env.TWITCH_USERNAME || '',
        oauthToken: process.env.TWITCH_OAUTH_TOKEN || '',
        channel: process.env.TWITCH_CHANNEL || '',
    },
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
    },
    ollama: {
        model: process.env.OLLAMA_MODEL || 'gemma3:4b',
    },
};

if (!config.twitch.username || !config.twitch.oauthToken || !config.twitch.channel) {
    console.warn('WARNING: Twitch credentials missing in .env');
}
