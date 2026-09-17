import axios from 'axios';
import { settingsStore } from '../store/settings';

export const YOUTUBE_REDIRECT_URI = 'http://localhost:3000/auth/youtube/callback';
const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];
const REFRESH_MARGIN_MS = 60 * 1000;

/** Google OAuth for the YouTube Data API (bans/timeouts). Mirrors authService for Twitch. */
export const googleAuth = {
    getAuthUrl: () => {
        const settings = settingsStore.get().platforms.youtube;
        const params = new URLSearchParams({
            client_id: settings.clientId,
            redirect_uri: YOUTUBE_REDIRECT_URI,
            response_type: 'code',
            scope: SCOPES.join(' '),
            access_type: 'offline', // we need a refresh token
            prompt: 'consent',      // Google only returns a refresh token when consent is (re)shown
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    },

    exchangeCodeForToken: async (code: string) => {
        const settings = settingsStore.get().platforms.youtube;
        try {
            const response = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
                client_id: settings.clientId,
                client_secret: settings.clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: YOUTUBE_REDIRECT_URI,
            }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

            const { access_token, refresh_token, expires_in } = response.data;
            settingsStore.updatePlatform('youtube', {
                accessToken: access_token,
                refreshToken: refresh_token || settings.refreshToken,
                expiresAt: Date.now() + (expires_in || 3600) * 1000,
            });
            return access_token as string;
        } catch (error: any) {
            console.error('Error exchanging Google code for token:', error.response?.data || error.message);
            throw error;
        }
    },

    refreshAccessToken: async () => {
        const settings = settingsStore.get().platforms.youtube;
        if (!settings.refreshToken) {
            throw new Error('No Google refresh token available');
        }
        try {
            const response = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
                client_id: settings.clientId,
                client_secret: settings.clientSecret,
                grant_type: 'refresh_token',
                refresh_token: settings.refreshToken,
            }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

            const { access_token, expires_in } = response.data;
            settingsStore.updatePlatform('youtube', {
                accessToken: access_token,
                expiresAt: Date.now() + (expires_in || 3600) * 1000,
            });
            return access_token as string;
        } catch (error: any) {
            console.error('Error refreshing Google token:', error.response?.data || error.message);
            throw error;
        }
    },

    /** Returns a valid access token, refreshing it when close to expiry. */
    getToken: async (): Promise<string | null> => {
        const settings = settingsStore.get().platforms.youtube;
        if (!settings.accessToken) return null;
        if (settings.expiresAt && settings.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
            return settings.accessToken;
        }
        try {
            return await googleAuth.refreshAccessToken();
        } catch {
            return null;
        }
    },

    hasToken: () => !!settingsStore.get().platforms.youtube.accessToken,
};
