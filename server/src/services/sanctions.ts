import { historyStore } from '../store/history';
import { settingsStore } from '../store/settings';
import { sanctionLog, SanctionEntry, SanctionSource } from '../store/sanctionLog';
import { PendingAction, Platform, userKey } from '../store/types';
import { platformRegistry } from '../platforms/registry';
import { PlatformCapabilityError } from '../platforms/types';

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

export interface SanctionTarget {
    platform: Platform;
    userId: string;
    displayName: string;
}

export interface SanctionRequest {
    target: SanctionTarget;
    kind: 'timeout' | 'ban';
    /** Seconds; defaults to the configured timeout. */
    duration?: number;
    reason: string;
    source: SanctionSource;
    ruleName?: string;
    by: 'streamer' | 'auto';
    /** Platform message ids to delete after the sanction (best effort). */
    deleteMessageIds?: string[];
    /** Snippets kept in the journal. */
    messages?: string[];
}

export interface SanctionResult {
    entry: SanctionEntry;
    deleted: number;
    deleteFailures: string[];
}

/** Turns a pending card into a sanction request (the resolve route and the auto executor share this). */
export function requestFromAction(action: PendingAction, kind: 'timeout' | 'ban', by: 'streamer' | 'auto', duration?: number): SanctionRequest {
    return {
        target: { platform: action.platform, userId: action.userId, displayName: action.displayName },
        kind,
        duration,
        reason: `Moderated: ${action.flaggedReason}`,
        source: action.source,
        ruleName: action.ruleName,
        by,
        deleteMessageIds: action.deleteMessages ? action.messageIds : [],
        messages: action.messageContent.split(' . '),
    };
}

/**
 * Executes a timeout/ban on the platform, deletes the offending messages when asked,
 * updates the user's status and records everything in the sanction log.
 * Throws when the platform call fails (nothing is logged in that case).
 */
export async function executeSanction(req: SanctionRequest): Promise<SanctionResult> {
    const platform = platformRegistry.get(req.target.platform);
    if (!platform.capabilities[req.kind]) throw new PlatformCapabilityError(req.target.platform, req.kind);

    const duration = req.kind === 'timeout' ? (req.duration || settingsStore.get().defaultTimeoutDuration || 600) : undefined;
    if (req.kind === 'ban') {
        await platform.ban(req.target.userId, req.reason);
    } else {
        await platform.timeout(req.target.userId, duration!, req.reason);
    }

    // Best effort — the sanction above is what matters, and Twitch/YouTube already purge a
    // timed-out/banned user's recent chat.
    let deleted = 0;
    const deleteFailures: string[] = [];
    if (req.deleteMessageIds?.length && platform.capabilities.deleteMessage) {
        for (const messageId of req.deleteMessageIds) {
            try {
                await platform.deleteMessage(messageId);
                deleted++;
            } catch (err) {
                deleteFailures.push(errorMessage(err));
            }
        }
        if (deleteFailures.length) console.warn(`[sanctions] ${deleteFailures.length} message deletion(s) failed on ${req.target.platform}:`, deleteFailures[0]);
    }

    const key = userKey(req.target.platform, req.target.userId);
    const entry = sanctionLog.add({
        platform: req.target.platform,
        userId: req.target.userId,
        userKey: key,
        displayName: req.target.displayName,
        action: req.kind,
        ...(duration ? { duration } : {}),
        reason: req.reason,
        source: req.source,
        ...(req.ruleName ? { ruleName: req.ruleName } : {}),
        by: req.by,
        messageIds: req.deleteMessageIds ?? [],
        messages: req.messages ?? [],
        ...(deleted ? { deletedMessages: deleted } : {}),
    });
    return { entry, deleted, deleteFailures };
}

/** Lifts a ban/timeout and records the unban. */
export async function unbanUser(target: SanctionTarget, source: SanctionSource = 'manual'): Promise<SanctionEntry> {
    const platform = platformRegistry.get(target.platform);
    if (!platform.capabilities.unban) throw new PlatformCapabilityError(target.platform, 'unban');
    await platform.unban(target.userId);
    historyStore.updateUserStatus(userKey(target.platform, target.userId), 'active');
    return sanctionLog.add({
        platform: target.platform,
        userId: target.userId,
        userKey: userKey(target.platform, target.userId),
        displayName: target.displayName,
        action: 'unban',
        reason: 'Undo from the sanction log',
        source,
        by: 'streamer',
        messageIds: [],
        messages: [],
    });
}

/** Undoes a logged timeout/ban. */
export async function revertSanction(entryId: string): Promise<SanctionEntry> {
    const entry = sanctionLog.get(entryId);
    if (!entry) throw new Error('Sanction not found');
    if (entry.action === 'unban' || entry.action === 'delete') throw new Error('This entry cannot be undone');
    if (entry.reverted) throw new Error('Already undone');

    await unbanUser({ platform: entry.platform, userId: entry.userId, displayName: entry.displayName }, entry.source);
    return sanctionLog.markReverted(entryId)!;
}
