import { render, screen, fireEvent } from '@testing-library/react';
import { ActionCard } from '../components/ActionCard';
import { vi, describe, it, expect } from 'vitest';
import { capsNone, makeAction } from './fixtures';

const mockAction = makeAction();

describe('ActionCard', () => {
    it('renders usage information correctly', () => {
        const mockFn = vi.fn();
        render(<ActionCard actions={[mockAction]} onResolve={mockFn} />);

        expect(screen.getByText('baduser')).toBeInTheDocument();
        expect(screen.getByText('Hate Speech')).toBeInTheDocument();
        expect(screen.getByText('"offensive message"')).toBeInTheDocument();
        expect(screen.getByTitle('Twitch')).toBeInTheDocument(); // platform badge
        expect(screen.getByText('Sev 4')).toBeInTheDocument();
    });

    it('triggers resolve callback on button click', () => {
        const mockFn = vi.fn();
        render(<ActionCard actions={[mockAction]} onResolve={mockFn} />);

        fireEvent.click(screen.getByText('Dismiss All'));
        expect(mockFn).toHaveBeenCalledWith(['123'], 'discarded');

        fireEvent.click(screen.getByText('BAN USER'));
        expect(mockFn).toHaveBeenCalledWith(['123'], 'approved', 'permanent');
    });

    it('hides moderation buttons for read-only platforms', () => {
        const tiktokAction = makeAction({ platform: 'tiktok', userKey: 'tiktok:baduser' });
        render(<ActionCard actions={[tiktokAction]} capabilities={capsNone} onResolve={vi.fn()} />);

        expect(screen.getByText('Dismiss All')).toBeInTheDocument();
        expect(screen.queryByText('BAN USER')).not.toBeInTheDocument();
        expect(screen.queryByText('Timeout')).not.toBeInTheDocument();
        expect(screen.getByText(/no moderation API/i)).toBeInTheDocument();
    });

    it('explains the link policy and highlights the suggested sanction', () => {
        const linkAction = makeAction({ flaggedReason: 'Link: bit.ly', category: 'spam', suggestedAction: 'ban', deleteMessages: true });
        render(<ActionCard actions={[linkAction]} onResolve={vi.fn()} />);

        expect(screen.getByTestId('link-policy-note')).toHaveTextContent(/deletes the message and bans the user/);
        expect(screen.getByText('BAN USER')).toHaveAttribute('title', 'Suggested action');
        expect(screen.getByText('Timeout')).not.toHaveAttribute('title');
    });

    it('shows no link note for ordinary AI flags', () => {
        render(<ActionCard actions={[mockAction]} onResolve={vi.fn()} />);
        expect(screen.queryByTestId('link-policy-note')).not.toBeInTheDocument();
    });
});
