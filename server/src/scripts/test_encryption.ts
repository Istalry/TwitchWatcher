import { settingsStore } from '../store/settings';
import fs from 'fs';
import path from 'path';

// Mock path for testing (optional, but store uses constant)
// We will just update and check file content

const main = async () => {
    console.log('[Test] Starting Encryption Test...');

    // 1. Save sensitive data
    console.log('[Test] Updating settings with secret...');
    const secret = "SuperSecretKey123";
    settingsStore.update(s => ({
        ...s,
        twitch: { ...s.twitch, clientSecret: secret }
    }));

    // 2. Read file directly to ensure it's encrypted
    const settingsPath = path.join(process.cwd(), 'settings.json');
    if (!fs.existsSync(settingsPath)) {
        console.error('[Test] FAIL: settings.json not found');
        return;
    }

    const rawContent = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(rawContent);

    if (parsed.twitch && parsed.twitch.clientSecret === secret) {
        console.error('[Test] FAIL: clientSecret found in plain text in settings.json!');
        console.log('File Content:', rawContent);
    } else {
        console.log('[Test] PASS: clientSecret is NOT plain text in file.');
        if (parsed.encryptedData) {
            console.log('[Test] PASS: Found encryptedData field.');
        } else {
            console.warn('[Test] WARN: No encryptedData field found? Structure:', parsed);
        }
    }

    // 3. Reload store and verify decryption
    console.log('[Test] Verifying Decryption via Store...');
    const loadedSettings = settingsStore.get();
    if (loadedSettings.twitch.clientSecret === secret) {
        console.log('[Test] PASS: Store correctly decrypted the secret.');
    } else {
        console.error('[Test] FAIL: Store failed to decrypt secret. Got:', loadedSettings.twitch.clientSecret);
    }

    console.log('[Test] Test Complete.');
};

main();
