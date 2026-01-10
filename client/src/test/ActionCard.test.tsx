import { render, screen, fireEvent } from '@testing-library/react';
import { ActionCard } from '../components/ActionCard';
import { vi, describe, it, expect } from 'vitest';
import { type PendingAction } from '../types';

const mockAction: PendingAction = {
    id: '123',
    username: 'baduser',
    messageContent: 'offensive message',
    flaggedReason: 'Hate Speech',
    suggestedAction: 'ban',
    timestamp: Date.now(),
    status: 'pending'
};

describe('ActionCard', () => {
    it('renders usage information correctly', () => {
        const mockFn = vi.fn();
        render(<ActionCard actions={[mockAction]} onResolve={mockFn} />);

        expect(screen.getByText('baduser')).toBeInTheDocument();
        expect(screen.getByText('Hate Speech')).toBeInTheDocument();
        expect(screen.getByText('"offensive message"')).toBeInTheDocument();
    });

    it('triggers resolve callback on button click', () => {
        const mockFn = vi.fn();
        render(<ActionCard actions={[mockAction]} onResolve={mockFn} />);

        fireEvent.click(screen.getByText('Dismiss All'));
        expect(mockFn).toHaveBeenCalledWith(['123'], 'discarded');

        fireEvent.click(screen.getByText('BAN USER'));
        expect(mockFn).toHaveBeenCalledWith(['123'], 'approved', 'permanent');
    });
});
