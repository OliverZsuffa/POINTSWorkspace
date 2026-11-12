import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

describe('sequence editor', () => {
  afterEach(cleanup);
  it('renders the workspace and notation editor', () => {
    render(<App />);
    expect(screen.getByRole('main', { name: 'POINTS Workspace' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Notation editor' })).toBeInTheDocument();
    expect(screen.getByText('Validation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LIFT' })).toBeInTheDocument();
  });

  it('adds notation to a selected cell and undo restores the empty cell', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));

    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 LIFT A' })).toBeInTheDocument();

    await user.click(screen.getByTitle('Undo'));
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' })).toBeInTheDocument();
  });

  it('exposes sequence settings and initial object distribution', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('region', { name: 'Sequence settings' })).toBeInTheDocument();
    expect(screen.getByText('Initial object distribution')).toBeInTheDocument();
  });
});
