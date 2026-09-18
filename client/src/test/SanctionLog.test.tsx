import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SanctionLog } from '../components/SanctionLog';
import type { SanctionEntry } from '../types';
import { platformsAllEnabled } from './fixtures';

const entry = (over: Partial<SanctionEntry> = {}): SanctionEntry => ({
    id: 'e1', at: Date.now(), platform: 'twitch', userId: '1', userKey: 'twitch:1', displayName: 'Troll',
    action: 'timeout', duration: 600, reason: 'Moderated: insult', source: 'ai', by: 'streamer',
    messageIds: ['m1'], messages: ['you idiot'], ...over,
});

describe('SanctionLog', () => {
    it('renders entries with action, source and auto markers', async () => {
        const fetchEntries = vi.fn(async () => [
            entry(),
            entry({ id: 'e2', action: 'ban', source: 'rule', ruleName: 'Caps', by: 'auto', platform: 'youtube' }),
        ]);
        render(<SanctionLog platforms={platformsAllEnabled} fetchEntries={fetchEntries} />);

        await waitFor(() => expect(screen.getAllByTestId('sanction-row')).toHaveLength(2));
        const [first, second] = screen.getAllByTestId('sanction-row');
        expect(first).toHaveTextContent('timeout 10 min');
        expect(first).toHaveTextContent('AI');
        expect(first).toHaveTextContent('you idiot');
        expect(second).toHaveTextContent('Rule: Caps');
        expect(second).toHaveTextContent('Auto');
        expect(screen.getAllByRole('button', { name: /Undo/ })).toHaveLength(2);
    });

    it('hides Undo for unbans, reverted entries and platforms without an unban API', async () => {
        const fetchEntries = vi.fn(async () => [
            entry({ id: 'u', action: 'unban' }),
            entry({ id: 'r', reverted: { at: Date.now() } }),
            entry({ id: 't', platform: 'tiktok' }),
        ]);
        render(<SanctionLog platforms={platformsAllEnabled} fetchEntries={fetchEntries} />);

        await waitFor(() => expect(screen.getAllByTestId('sanction-row')).toHaveLength(3));
        expect(screen.queryByRole('button', { name: /Undo/ })).not.toBeInTheDocument();
        expect(screen.getByText('Undone')).toBeInTheDocument();
    });
});
