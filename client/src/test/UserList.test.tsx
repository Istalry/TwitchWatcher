import { render, screen, fireEvent } from '@testing-library/react';
import { UserList } from '../components/UserList';
import { describe, it, expect } from 'vitest';
import { type ChatUser } from '../types';

const mockUsers: ChatUser[] = [
    {
        username: 'testuser1',
        messages: [
            { id: '1', content: 'hello', timestamp: Date.now(), username: 'testuser1' }
        ],
        status: 'active'
    },
    {
        username: 'banneduser',
        messages: [],
        status: 'banned'
    }
];

describe('UserList', () => {
    it('renders the list of users', () => {
        render(<UserList users={mockUsers} />);
        expect(screen.getByText('testuser1')).toBeInTheDocument();
        expect(screen.getByText('banneduser')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // Count
    });

    it('shows user details when clicked', () => {
        render(<UserList users={mockUsers} />);

        // Click on user
        fireEvent.click(screen.getByText('testuser1'));

        // Expect details to appear (Message history)
        expect(screen.getByText('hello')).toBeInTheDocument();
    });

    it('renders empty state initially', () => {
        render(<UserList users={mockUsers} />);
        expect(screen.getByText('No User Selected')).toBeInTheDocument();
    });
});
