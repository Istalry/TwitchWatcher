import dotenv from 'dotenv';
dotenv.config();

export const config = {
    twitch: {
        username: process.env.TWITCH_USERNAME || '',
        channel: process.env.TWITCH_CHANNEL || '',
        clientId: process.env.TWITCH_CLIENT_ID || '',
        clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
        redirectUri: process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/twitch/callback',
    },
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
    },
    ai: {
        provider: (process.env.AI_PROVIDER || 'ollama') as 'ollama' | 'google',
        apiKey: process.env.GOOGLE_API_KEY || '',
        model: process.env.AI_MODEL || (process.env.AI_PROVIDER === 'google' ? 'gemma-2-27b-it' : 'gemma3:4b'),
    },
};

if (!config.twitch.username || !config.twitch.channel) {
    console.warn('WARNING: Initial Twitch config missing. Please run setup or configure .env');
}
