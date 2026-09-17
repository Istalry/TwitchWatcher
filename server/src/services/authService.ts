import axios from 'axios';
import { settingsStore } from '../store/settings';

export const TWITCH_REDIRECT_URI = 'http://localhost:3000/auth/twitch/callback';

// Twitch asks apps to validate tokens roughly hourly; we cache the check so
// every Helix call doesn't pay for a round-trip to /oauth2/validate.
const VALIDATION_TTL_MS = 5 * 60 * 1000;

let lastValidated: { token: string; at: number } | null = null;

export const authService = {
    // Generate the URL for the user to authorize on Twitch
    getAuthUrl: () => {
        const settings = settingsStore.get().platforms.twitch;
        const scopes = [
            'chat:read',
            'chat:edit',
            'channel:moderate',
            'moderator:manage:banned_users',
            'moderator:manage:chat_messages'
        ];

        const params = new URLSearchParams({
            client_id: settings.clientId,
            redirect_uri: TWITCH_REDIRECT_URI,
            response_type: 'code',
            scope: scopes.join(' '),
        });
        return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
    },

    // Exchange the authorization code for an access token
    exchangeCodeForToken: async (code: string) => {
        const settings = settingsStore.get().platforms.twitch;

        try {
            const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                params: {
                    client_id: settings.clientId,
                    client_secret: settings.clientSecret,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: TWITCH_REDIRECT_URI,
                },
            });

            const { access_token, refresh_token } = response.data;

            settingsStore.updatePlatform('twitch', {
                accessToken: access_token,
                refreshToken: refresh_token,
            });
            lastValidated = { token: access_token, at: Date.now() };

            return access_token;
        } catch (error) {
            console.error('Error exchanging code for token:', error);
            throw error;
        }
    },

    // Refresh the access token using the refresh token
    refreshAccessToken: async () => {
        const settings = settingsStore.get().platforms.twitch;
        if (!settings.refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                params: {
                    client_id: settings.clientId,
                    client_secret: settings.clientSecret,
                    grant_type: 'refresh_token',
                    refresh_token: settings.refreshToken,
                },
            });

            const { access_token, refresh_token } = response.data;

            settingsStore.updatePlatform('twitch', {
                accessToken: access_token,
                refreshToken: refresh_token || settings.refreshToken,
            });
            lastValidated = { token: access_token, at: Date.now() };

            return access_token;
        } catch (error) {
            console.error('Error refreshing token:', error);
            throw error;
        }
    },

    /** Forget the cached validation, e.g. after a 401 from Helix. */
    invalidate: () => {
        lastValidated = null;
    },

    // Get a valid access token, validating (cached) and refreshing if needed.
    getToken: async (): Promise<string | null> => {
        const settings = settingsStore.get().platforms.twitch;
        if (!settings.accessToken) {
            return null;
        }

        if (lastValidated && lastValidated.token === settings.accessToken && Date.now() - lastValidated.at < VALIDATION_TTL_MS) {
            return settings.accessToken;
        }

        try {
            await axios.get('https://id.twitch.tv/oauth2/validate', {
                headers: { 'Authorization': `OAuth ${settings.accessToken}` }
            });
            lastValidated = { token: settings.accessToken, at: Date.now() };
            return settings.accessToken;
        } catch (e) {
            // Token likely invalid/expired
            console.log('Token invalid or expired, refreshing...');
            try {
                return await authService.refreshAccessToken();
            } catch (refreshErr) {
                console.error('Failed to refresh token automatically.');
                return null;
            }
        }
    },

    hasToken: () => {
        const settings = settingsStore.get().platforms.twitch;
        return !!settings.accessToken;
    }
};
