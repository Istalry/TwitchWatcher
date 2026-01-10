import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ENV_PATH = path.join(__dirname, '../../.env');

const question = (query: string): Promise<string> => {
    return new Promise((resolve) => rl.question(query, resolve));
};

const setup = async () => {
    console.log('\n=== Twitch Auto-Moderator Setup ===\n');

    let currentConfig: any = {};

    if (fs.existsSync(ENV_PATH)) {
        console.log('Refining existing .env configuration...');
        const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) currentConfig[key.trim()] = value.trim();
        });
    } else {
        console.log('Creating new configuration...');
    }

    console.log('\n--- Twitch Credentials ---');
    console.log('You will need to create an Application on the Twitch Developer Console.');
    console.log('1. Go to https://dev.twitch.tv/console/apps/create');
    console.log('2. Name: e.g. "My AutoMod Bot"');
    console.log('3. OAuth Redirect URLs: http://localhost:3000/auth/twitch/callback');
    console.log('4. Category: Chat Bot');
    console.log('5. Create and copy Client ID and Client Secret.');
    console.log('--------------------------\n');

    const username = await question(`Twitch Bot Username (${currentConfig.TWITCH_USERNAME || ''}): `) || currentConfig.TWITCH_USERNAME;
    const channel = await question(`Target Channel to Moderate (${currentConfig.TWITCH_CHANNEL || ''}): `) || currentConfig.TWITCH_CHANNEL;
    const clientId = await question(`Client ID (${currentConfig.TWITCH_CLIENT_ID || ''}): `) || currentConfig.TWITCH_CLIENT_ID;
    const clientSecret = await question(`Client Secret (${currentConfig.TWITCH_CLIENT_SECRET || ''}): `) || currentConfig.TWITCH_CLIENT_SECRET;

    const aiProvider = await question(`AI Provider (ollama/google) [default: ollama]: `) || currentConfig.AI_PROVIDER || 'ollama';
    let apiKey = '';
    let aiModel = '';

    if (aiProvider === 'google') {
        apiKey = await question(`Google AI Studio API Key (${currentConfig.GOOGLE_API_KEY ? '*****' : 'Required'}): `) || currentConfig.GOOGLE_API_KEY;

        if (!apiKey) {
            console.error('\n[!] Error: Google API Key is required when using Google provider.\n');
            process.exit(1);
        }

        // Fetch available models
        console.log('Fetching available models from Google AI Studio...');
        try {
            const { default: axios } = await import('axios');
            const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const models = (res.data.models || [])
                .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                .map((m: any) => m.name.replace('models/', ''));

            if (models.length > 0) {
                console.log('\nAvailable Models:');
                models.forEach((m: string, i: number) => console.log(`${i + 1}. ${m}`));

                const selection = await question(`\nSelect Model (1-${models.length}) [default: gemma-3-27b-it]: `);
                if (selection && parseInt(selection) > 0 && parseInt(selection) <= models.length) {
                    aiModel = models[parseInt(selection) - 1];
                } else {
                    aiModel = models.find((m: string) => m.includes('gemma-3-27b-it')) || models[0];
                }
                console.log(`Selected: ${aiModel}`);
            } else {
                console.log('No models found, using default.');
                aiModel = await question(`Google AI Model [default: gemma-3-27b-it]: `) || currentConfig.AI_MODEL || 'gemma-3-27b-it';
            }
        } catch (err: any) {
            console.error('Failed to list models:', err.message);
            aiModel = await question(`Google AI Model [default: gemma-3-27b-it]: `) || currentConfig.AI_MODEL || 'gemma-3-27b-it';
        }

    } else {
        aiModel = await question(`Ollama Model [default: gemma3:4b]: `) || currentConfig.AI_MODEL || 'gemma3:4b';
    }

    if (!username || !channel || !clientId || !clientSecret) {
        console.error('\n[!] Error: Twitch credentials are required.\n');
        process.exit(1);
    }

    if (aiProvider === 'google' && !apiKey) {
        console.error('\n[!] Error: Google API Key is required when using Google provider.\n');
        process.exit(1);
    }

    const envContent = `
TWITCH_USERNAME=${username}
TWITCH_CHANNEL=${channel}
TWITCH_CLIENT_ID=${clientId}
TWITCH_CLIENT_SECRET=${clientSecret}
TWITCH_REDIRECT_URI=http://localhost:3000/auth/twitch/callback
PORT=3000
AI_PROVIDER=${aiProvider}
AI_MODEL=${aiModel}
GOOGLE_API_KEY=${apiKey}
`.trim();

    fs.writeFileSync(ENV_PATH, envContent);
    console.log('\n[Ok] Configuration saved to server/.env');
    console.log('\n=== Setup Complete ===');
    console.log('Please run "start_app.bat" to launch.');

    rl.close();
};

setup().catch(console.error);
