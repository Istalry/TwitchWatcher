import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LiveChat } from '../components/LiveChat';
import { makeAction, makeMessage, platformsAllEnabled } from './fixtures';

const messages = [
    makeMessage({ id: 'a', platform: 'twitch', content: 'gg wp' }),
    makeMessage({ id: 'b', platform: 'youtube', userKey: 'youtube:yt1', displayName: 'YtUser', content: 'nice stream' }),
    makeMessage({ id: 'c', platform: 'tiktok', userKey: 'tiktok:tt1', displayName: 'TtUser', content: 'you suck' }),
];

describe('LiveChat', () => {
    it('renders one row per message with its platform badge', () => {
        render(<LiveChat messages={messages} actions={[]} platforms={platformsAllEnabled} connected />);
        expect(screen.getAllByTestId('chat-row')).toHaveLength(3);
        expect(screen.getByText('gg wp')).toBeInTheDocument();
        expect(screen.getByTitle('YouTube')).toBeInTheDocument();
    });

    it('highlights rows referenced by a pending action', () => {
        const action = makeAction({ platform: 'tiktok', userKey: 'tiktok:tt1', messageIds: ['c'], flaggedReason: 'Insult' });
        render(<LiveChat messages={messages} actions={[action]} platforms={platformsAllEnabled} connected />);
        const flagged = screen.getAllByTestId('chat-row').filter(r => r.getAttribute('data-flagged') === 'true');
        expect(flagged).toHaveLength(1);
        expect(flagged[0]).toHaveTextContent('you suck');
        expect(flagged[0]).toHaveTextContent('Insult');
    });

    it('filters by platform', () => {
        render(<LiveChat messages={messages} actions={[]} platforms={platformsAllEnabled} connected />);
        fireEvent.click(screen.getByRole('tab', { name: 'YouTube' }));
        expect(screen.getAllByTestId('chat-row')).toHaveLength(1);
        expect(screen.getByText('nice stream')).toBeInTheDocument();
    });

    it('offers quick actions only where the platform can moderate', () => {
        const onModerate = vi.fn();
        render(<LiveChat messages={messages} actions={[]} platforms={platformsAllEnabled} connected onModerate={onModerate} />);
        // Twitch + YouTube rows get Ban buttons, the TikTok row doesn't.
        expect(screen.getAllByTitle('Ban')).toHaveLength(2);
        fireEvent.click(screen.getAllByTitle('Ban')[0]);
        expect(onModerate).toHaveBeenCalledWith('twitch:user1', 'ban');
    });
});
