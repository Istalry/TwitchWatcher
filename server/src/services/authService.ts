import axios from 'axios';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

const TOKEN_PATH = path.join(__dirname, '../../tokens.json');

interface TokenData {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scope: string[];
}

export const authService = {
    // Generate the URL for the user to authorize on Twitch
    getAuthUrl: () => {
        const scopes = [
            'chat:read',
            'chat:edit',
            'channel:moderate',
            'moderator:manage:banned_users',
            'moderator:manage:chat_messages' // for deleting messages if needed
        ];
        const params = new URLSearchParams({
            client_id: config.twitch.clientId,
            redirect_uri: config.twitch.redirectUri,
            response_type: 'code',
            scope: scopes.join(' '),
        });
        return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
    },

    // Exchange the authorization code for an access token
    exchangeCodeForToken: async (code: string) => {
        try {
            const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                params: {
                    client_id: config.twitch.clientId,
                    client_secret: config.twitch.clientSecret,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: config.twitch.redirectUri,
                },
            });

            const { access_token, refresh_token, expires_in, scope } = response.data;
            const tokenData: TokenData = {
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: Date.now() + expires_in * 1000,
                scope,
            };

            authService.saveToken(tokenData);
            return tokenData;
        } catch (error) {
            console.error('Error exchanging code for token:', error);
            throw error;
        }
    },

    // Refresh the access token using the refresh token
    refreshAccessToken: async () => {
        const currentToken = authService.loadToken();
        if (!currentToken || !currentToken.refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                params: {
                    client_id: config.twitch.clientId,
                    client_secret: config.twitch.clientSecret,
                    grant_type: 'refresh_token',
                    refresh_token: currentToken.refreshToken,
                },
            });

            const { access_token, refresh_token, expires_in, scope } = response.data;
            const tokenData: TokenData = {
                accessToken: access_token,
                refreshToken: refresh_token || currentToken.refreshToken, // Keep old refresh token if new one is not returned (unusual but possible)
                expiresAt: Date.now() + expires_in * 1000,
                scope: scope || currentToken.scope,
            };

            authService.saveToken(tokenData);
            return tokenData.accessToken;
        } catch (error) {
            console.error('Error refreshing token:', error);
            throw error;
        }
    },

    // Get a valid access token (refreshes if needed)
    getToken: async () => {
        const token = authService.loadToken();
        if (!token) {
            return null;
        }

        // Refresh if expiring in less than 5 minutes
        if (Date.now() > token.expiresAt - 5 * 60 * 1000) {
            console.log('Token expiring soon, refreshing...');
            return await authService.refreshAccessToken();
        }

        return token.accessToken;
    },

    saveToken: (tokenData: TokenData) => {
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
    },

    loadToken: (): TokenData | null => {
        if (!fs.existsSync(TOKEN_PATH)) {
            return null;
        }
        try {
            return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        } catch (err) {
            console.error('Failed to parse tokens.json', err);
            return null;
        }
    },

    hasToken: () => {
        return fs.existsSync(TOKEN_PATH);
    }
};
