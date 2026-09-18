import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RulesEditor } from '../components/RulesEditor';
import type { Rule } from '../types';

const capsRule: Rule = { id: 'r1', name: 'No caps', enabled: true, type: 'caps', category: 'other', action: 'timeout', deleteMessage: true, auto: true };

describe('RulesEditor', () => {
    it('lists rules with their summary and toggles them', () => {
        const onChange = vi.fn();
        render(<RulesEditor rules={[capsRule]} onChange={onChange} autoEnabled />);

        const row = screen.getByTestId('rule-row');
        expect(row).toHaveTextContent('No caps');
        expect(row).toHaveTextContent('≥ 12 letters, ≥ 70% caps');
        expect(row).toHaveTextContent('auto');

        fireEvent.click(screen.getByLabelText('Enable rule No caps'));
        expect(onChange).toHaveBeenCalledWith([{ ...capsRule, enabled: false }]);
    });

    it('adds a words rule from the form and validates it', () => {
        const onChange = vi.fn();
        render(<RulesEditor rules={[]} onChange={onChange} autoEnabled={false} />);

        fireEvent.click(screen.getByRole('button', { name: /Add rule/ }));
        fireEvent.click(screen.getByRole('button', { name: /Save rule/ }));
        expect(screen.getByText('Give the rule a name.')).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Scam words' } });
        fireEvent.change(screen.getByLabelText('Words / phrases'), { target: { value: 'free skins\n buy followers ,\n' } });
        fireEvent.change(screen.getByLabelText('Sanction'), { target: { value: 'ban' } });
        fireEvent.click(screen.getByRole('button', { name: /Save rule/ }));

        expect(onChange).toHaveBeenCalledTimes(1);
        const [rules] = onChange.mock.calls[0] as [Rule[]];
        expect(rules).toHaveLength(1);
        expect(rules[0]).toMatchObject({ name: 'Scam words', type: 'words', words: ['free skins', 'buy followers'], action: 'ban', deleteMessage: true, auto: false });
        expect(screen.queryByTestId('rule-form')).not.toBeInTheDocument();
    });

    it('rejects an invalid regex', () => {
        const onChange = vi.fn();
        render(<RulesEditor rules={[]} onChange={onChange} autoEnabled={false} />);
        fireEvent.click(screen.getByRole('button', { name: /Add rule/ }));
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bad' } });
        fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'regex' } });
        fireEvent.change(screen.getByLabelText('Pattern'), { target: { value: '(' } });
        fireEvent.click(screen.getByRole('button', { name: /Save rule/ }));
        expect(screen.getByText(/Invalid regular expression/)).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });
});
