import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('draws a complete ball rectangle with Shift and drag', () => {
    render(<App />);

    const start = screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' });
    const middle = screen.getByRole('button', { name: 'Juggler 1 left beat 2 empty' });
    const end = screen.getByRole('button', { name: 'Juggler 1 left beat 3 empty' });

    fireEvent.mouseDown(start, { shiftKey: true });
    fireEvent.mouseUp(end);

    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 LIFT A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 2 HOLD' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 3 LEAVE A' })).toBeInTheDocument();
    expect(screen.getByText('Sequence valid')).toBeInTheDocument();
  });

  it('leaves the other linked SPECIAL action standalone when one side is deleted', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'CLAP' }));
    expect(screen.getByRole('button', { name: 'Juggler 1 right beat 1 Clap' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('button', { name: 'Juggler 1 right beat 1 Clap' })).toBeInTheDocument();
    expect(screen.getByText('Sequence valid')).toBeInTheDocument();
  });

  it('exposes sequence settings and initial object distribution', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('region', { name: 'Sequence settings' })).toBeInTheDocument();
    expect(screen.getByText('Initial object distribution')).toBeInTheDocument();
  });
});
