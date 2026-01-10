import axios from 'axios';
import { settingsStore } from '../store/settings';

export const authService = {
    // Generate the URL for the user to authorize on Twitch
    getAuthUrl: () => {
        const settings = settingsStore.get().twitch;
        const scopes = [
            'chat:read',
            'chat:edit',
            'channel:moderate',
            'moderator:manage:banned_users',
            'moderator:manage:chat_messages'
        ];
        // Ensure redirect URI matches what we registered or default
        const redirectUri = 'http://localhost:3000/auth/twitch/callback';

        const params = new URLSearchParams({
            client_id: settings.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: scopes.join(' '),
        });
        return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
    },

    // Exchange the authorization code for an access token
    exchangeCodeForToken: async (code: string) => {
        const settings = settingsStore.get().twitch;
        const redirectUri = 'http://localhost:3000/auth/twitch/callback';

        try {
            const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                params: {
                    client_id: settings.clientId,
                    client_secret: settings.clientSecret,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: redirectUri,
                },
            });

            const { access_token, refresh_token, expires_in, scope } = response.data;

            // Save to Secure Settings
            settingsStore.updateTwitch({
                accessToken: access_token,
                refreshToken: refresh_token,
                // We don't store expiresAt explicitly in settings currently, maybe we should've added it?
                // For now, we'll rely on try/catch refresh flow or 401s if we don't track expiry.
                // Or I can add expiresAt to settings.ts interface. 
                // Let's assume we refresh on 401 or simply try refreshing if it fails.
                // But the previous logic had proactive refresh.
                // Let's stick to simple structure for now or maybe just force refresh if we suspect issues.
                // Actually, let's keep it simple. If 401, logic elsewhere should retry.
                // To keep this refactor safe, I will auto-refresh on startup or get access.
            });

            return access_token;
        } catch (error) {
            console.error('Error exchanging code for token:', error);
            throw error;
        }
    },

    // Refresh the access token using the refresh token
    refreshAccessToken: async () => {
        const settings = settingsStore.get().twitch;
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

            settingsStore.updateTwitch({
                accessToken: access_token,
                refreshToken: refresh_token || settings.refreshToken,
            });

            return access_token;
        } catch (error) {
            console.error('Error refreshing token:', error);
            throw error;
        }
    },

    // Get a valid access token (refreshes if needed validation check fails? No, simplistic for now)
    getToken: async () => {
        const settings = settingsStore.get().twitch;
        if (!settings.accessToken) {
            return null;
        }

        // Validate? Or just return. 
        // Real-world: Should check validation endpoint.
        // For this project: Return token. If it fails, the consumer should trigger refresh?
        // Or we can just validate it via Twitch API validation endpoint.
        try {
            await axios.get('https://id.twitch.tv/oauth2/validate', {
                headers: { 'Authorization': `OAuth ${settings.accessToken}` }
            });
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
        const settings = settingsStore.get().twitch;
        return !!settings.accessToken;
    }
};
