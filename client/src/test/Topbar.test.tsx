import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Topbar } from '../components/Topbar';
import { EMPTY_STATUS } from '../types';

describe('Topbar update banner', () => {
    it('shows nothing when no update is known', () => {
        render(<Topbar onShutdown={vi.fn()} status={EMPTY_STATUS} update={null} />);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('advertises a newer release with a download link and a dismiss button', () => {
        const onDismiss = vi.fn();
        render(
            <Topbar
                onShutdown={vi.fn()}
                status={EMPTY_STATUS}
                update={{ latestVersion: '2.1.0', url: 'https://github.com/Istalry/TwitchWatcher/releases/tag/v2.1.0' }}
                onDismissUpdate={onDismiss}
            />
        );

        const banner = screen.getByRole('status');
        expect(banner).toHaveTextContent('Update available: v2.1.0');
        expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', 'https://github.com/Istalry/TwitchWatcher/releases/tag/v2.1.0');

        fireEvent.click(screen.getByRole('button', { name: 'Dismiss update notice' }));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});
