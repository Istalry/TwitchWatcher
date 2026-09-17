import { render, screen, fireEvent } from '@testing-library/react';
import { UserList } from '../components/UserList';
import { describe, it, expect } from 'vitest';
import { makeUser, platformsAllEnabled } from './fixtures';

const mockUsers = [
    makeUser({
        messages: [{ id: '1', platform: 'twitch', userKey: 'twitch:testuser1', username: 'testuser1', displayName: 'testuser1', content: 'hello', timestamp: Date.now() }],
    }),
    makeUser({ key: 'twitch:banneduser', userId: 'banneduser', username: 'banneduser', displayName: 'banneduser', status: 'banned' }),
    makeUser({ key: 'tiktok:tt', platform: 'tiktok', userId: 'tt', username: 'tt', displayName: 'TikTokUser' }),
];

describe('UserList', () => {
    it('renders the list of users', () => {
        render(<UserList users={mockUsers} />);
        expect(screen.getByText('testuser1')).toBeInTheDocument();
        expect(screen.getByText('banneduser')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument(); // Count
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

    it('only offers moderation buttons the platform supports', () => {
        render(<UserList users={mockUsers} platforms={platformsAllEnabled} />);
        // Twitch active user: timeout + ban; banned user: unban; TikTok: nothing.
        expect(screen.getAllByTitle('Timeout')).toHaveLength(1);
        expect(screen.getAllByTitle('Ban')).toHaveLength(1);
        expect(screen.getAllByTitle('Unban')).toHaveLength(1);
    });
});
