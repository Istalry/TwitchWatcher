import axios from 'axios';
import { settingsStore } from '../store/settings';
import { APP_VERSION, GITHUB_REPO, RELEASES_URL, compareVersions } from '../version';

const FIRST_CHECK_DELAY_MS = 10 * 1000;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface UpdateInfo {
    latestVersion: string;
    url: string;
}

class UpdateChecker {
    private latest: UpdateInfo | null = null;
    private timer: NodeJS.Timeout | null = null;

    /** The newest release found so far, or null when up to date / unknown. */
    public available(): UpdateInfo | null {
        return this.latest;
    }

    public start() {
        if (process.env.NO_UPDATE_CHECK) return;
        if (this.timer) return;
        setTimeout(() => this.check(), FIRST_CHECK_DELAY_MS).unref();
        this.timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
        this.timer.unref();
    }

    public async check(): Promise<UpdateInfo | null> {
        if (!settingsStore.get().checkForUpdates) return this.latest;
        try {
            const res = await axios.get(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
                timeout: 5000,
                headers: {
                    Accept: 'application/vnd.github+json',
                    'User-Agent': `TwitchWatcher/${APP_VERSION}`,
                },
            });
            const tag: string = res.data?.tag_name ?? '';
            const url: string = res.data?.html_url ?? RELEASES_URL;
            if (tag && compareVersions(tag, APP_VERSION) > 0) {
                this.latest = { latestVersion: tag.replace(/^v/i, ''), url };
                console.log(`[Update] A newer version is available: ${tag} (running ${APP_VERSION})`);
            } else {
                this.latest = null;
            }
        } catch (err: any) {
            // Offline or rate limited: not worth surfacing to the user.
            if (process.env.DEBUG_AI) console.warn('[Update] Check failed:', err?.message ?? err);
        }
        return this.latest;
    }
}

export const updateChecker = new UpdateChecker();
