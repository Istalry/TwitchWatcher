import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NetworkQRCode } from '../components/NetworkQRCode';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('NetworkQRCode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing initially when ip is not yet fetched', () => {
        fetchMock.mockResolvedValueOnce({
            json: async () => ({ ip: '192.168.1.100' }),
        });

        const { container } = render(<NetworkQRCode />);
        expect(container.firstChild).toBeNull();
    });

    it('renders QR code and toggles visibility', async () => {
        fetchMock.mockResolvedValueOnce({
            json: async () => ({ ip: '192.168.1.100' }),
        });

        render(<NetworkQRCode />);

        // Wait for IP to be fetched and component to render
        await waitFor(() => {
            expect(screen.getByText(/Scan to Connect/i)).toBeInTheDocument();
        });

        expect(screen.getByText(/http:\/\/192\.168\.1\.100/)).toBeInTheDocument();

        // Check if button text says "Hide" (since default is open)
        const button = screen.getByRole('button');
        expect(button).toHaveTextContent(/Hide QR Code/i);

        // Click to hide
        fireEvent.click(button);

        // Wait for animation out (or check strictly if element is removed from DOM by AnimatePresence)
        // Note: AnimatePresence might keep it in DOM for exit animation, so we might need to wait or check class/style.
        // But logic-wise test:
        expect(button).toHaveTextContent(/Remote Access/i);
    });
});
