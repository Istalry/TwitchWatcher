import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar';
import { vi, describe, it, expect } from 'vitest';

describe('Sidebar', () => {
    it('renders all navigation tabs', () => {
        const mockFn = vi.fn();
        render(<Sidebar activeTab="actions" setActiveTab={mockFn} />);

        expect(screen.getByText('Actions')).toBeInTheDocument();
        expect(screen.getByText('Live Users')).toBeInTheDocument();
        expect(screen.getByText('Debug')).toBeInTheDocument();
    });

    it('highlights the active tab', () => {
        const mockFn = vi.fn();
        render(<Sidebar activeTab="users" setActiveTab={mockFn} />);

        const usersTab = screen.getByText('Live Users').closest('button');
        expect(usersTab).toHaveClass('bg-blue-600');
    });

    it('calls setActiveTab when a tab is clicked', () => {
        const mockFn = vi.fn();
        render(<Sidebar activeTab="actions" setActiveTab={mockFn} />);

        fireEvent.click(screen.getByText('Live Users'));
        expect(mockFn).toHaveBeenCalledWith('users');
    });
});
