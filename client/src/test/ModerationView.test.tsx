import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModerationView } from '../components/ModerationView';
import { EMPTY_STATUS } from '../types';
import { makeAction, makeMessage, platformsAllEnabled } from './fixtures';

const baseProps = {
    messages: [makeMessage({ id: 'm1', content: 'hey' })],
    actions: [makeAction({ messageIds: ['m1'] })],
    platforms: platformsAllEnabled,
    streamConnected: true,
    onResolve: vi.fn(),
    onModerate: vi.fn(),
    onOpenSettings: vi.fn(),
};

describe('ModerationView', () => {
    it('renders the chat feed and the action queue side by side', () => {
        render(<ModerationView {...baseProps} />);
        expect(screen.getByText('Live Chat')).toBeInTheDocument();
        expect(screen.getByText('Action Required')).toBeInTheDocument();
        expect(screen.getByText('"offensive message"')).toBeInTheDocument();
        expect(screen.getByText(/1 Pending/)).toBeInTheDocument();
    });

    it('toggles panes on narrow screens', () => {
        render(<ModerationView {...baseProps} />);
        const chatPane = screen.getByText('Live Chat').closest('[class*="col-span"]') as HTMLElement;
        expect(chatPane.className).toContain('block');
        fireEvent.click(screen.getByRole('tab', { name: /Queue/ }));
        expect(chatPane.className).toContain('hidden');
    });

    it('points to Settings when no platform is enabled', () => {
        const onOpenSettings = vi.fn();
        render(<ModerationView {...baseProps} platforms={EMPTY_STATUS.platforms} onOpenSettings={onOpenSettings} />);
        expect(screen.getByText('No platform connected')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Open Settings'));
        expect(onOpenSettings).toHaveBeenCalled();
    });
});
