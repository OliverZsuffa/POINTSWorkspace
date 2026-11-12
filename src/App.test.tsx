import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./features/renderer/SequenceRenderer', () => ({
  default: () => <section aria-label="Sequence renderer"><button type="button">Play</button></section>,
}));

import App from './App';

describe('sequence editor', () => {
  afterEach(cleanup);
  it('renders the workspace and notation editor', () => {
    render(<App />);
    expect(screen.getByRole('main', { name: 'POINTS Workspace' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Notation editor' })).toBeInTheDocument();
    expect(screen.getByText('Validation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
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
    expect(screen.getAllByLabelText('Linked SPECIAL')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('button', { name: 'Juggler 1 right beat 1 Clap' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Linked SPECIAL')).not.toBeInTheDocument();
    expect(screen.getByText('Sequence valid')).toBeInTheDocument();
  });

  it('moves the selected cell with the arrow keys', () => {
    render(<App />);

    const first = screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' });
    const second = screen.getByRole('button', { name: 'Juggler 1 left beat 2 empty' });

    fireEvent.click(first);
    fireEvent.keyDown(first, { key: 'ArrowRight' });

    expect(second).toHaveClass('selected');
  });

  it('adds and renames table positions in sequence settings', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Add position' }));

    const newPosition = screen.getByRole('textbox', { name: 'Rename position D' });
    await user.clear(newPosition);
    await user.type(newPosition, 'E');
    fireEvent.blur(newPosition);

    expect(screen.getByRole('textbox', { name: 'Rename position E' })).toBeInTheDocument();
  });

  it('sets initial objects by clicking visible positions', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'A, occupied' }));
    expect(screen.getByRole('button', { name: 'A, empty' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'A, empty' }));
    expect(screen.getByRole('button', { name: 'A, occupied' })).toBeInTheDocument();
  });

  it('renders notation using large target labels and square cells', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));

    const symbol = screen.getByRole('button', { name: 'Juggler 1 left beat 1 LIFT A' }).querySelector('svg.ball-segment');
    expect(symbol).toBeInTheDocument();
    expect(symbol).toHaveAttribute('viewBox', '0 0 100 100');
    expect(symbol?.querySelector('path')).toHaveAttribute('d', 'M0 19H100 M0 19V81 M0 81H100');
    expect(symbol?.querySelector('text')).toHaveAttribute('font-size', '38');
  });

  it('opens the interactive sequence renderer from the top bar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Renderer' }));
    expect(screen.getByRole('region', { name: 'Sequence renderer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('exposes sequence settings and initial object distribution', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('region', { name: 'Sequence settings' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Initial positions' })).toBeInTheDocument();
  });

  it('starts with two balls at A and C', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'A, occupied' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'C, occupied' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B, empty' })).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('shows object state after the selected beat', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    await user.click(screen.getByRole('button', { name: /Object state/ }));
    expect(screen.getByText('After beat 1')).toBeInTheDocument();
    expect(screen.getByText('Juggler 1 left')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 2 empty' }));
    await user.click(screen.getByRole('button', { name: 'LEAVE' }));
    expect(screen.getByText('After beat 2')).toBeInTheDocument();
    expect(screen.queryByText('Juggler 1 left')).not.toBeInTheDocument();
    expect(container.querySelector('.state-content')?.textContent).toContain('A');
  });

  it('adds two balls with a new performer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Add performer' }));
    expect(screen.getByText('4 / 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 2 left beat 1 empty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 2 right beat 1 empty' })).toBeInTheDocument();
  });

  it('allows LIFT and LEAVE to target the acting performer hand backs', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    await user.selectOptions(screen.getByLabelText('Target'), 'back-right');
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 LIFT R' })).toBeInTheDocument();
  });

  it('creates an individual pass using explicit performer and hand controls', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Add performer' }));
    await user.selectOptions(screen.getByLabelText('Type'), 'individual-passing');
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.selectOptions(screen.getByLabelText('Pass to'), screen.getByRole('option', { name: /Juggler 2/ }));
    await user.selectOptions(screen.getByLabelText('Hand'), 'right');
    await user.click(screen.getByRole('button', { name: 'PASS' }));
    const leaveCell = screen.getByRole('button', { name: /Juggler 1 left beat 1 LEAVE/ });
    const liftCell = screen.getByRole('button', { name: /Juggler 2 right beat 1 LIFT/ });
    expect(leaveCell.querySelector('tspan')?.textContent).toBe('b');
    expect(liftCell.querySelector('tspan')?.textContent).toBe('a');
    expect(screen.getByLabelText('Recipient')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Hand')).toHaveLength(1);
  });

  it('uses the acting performer as the default circle passing target', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.selectOptions(screen.getByLabelText('Type'), 'circle-passing');
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    expect(screen.getByLabelText('Performer')).toHaveValue('self');
    expect(screen.queryByLabelText('Direction')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Distance')).not.toBeInTheDocument();
  });

  it('renders the direction as a subscript for another circle performer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Add performer' }));
    await user.selectOptions(screen.getByLabelText('Type'), 'circle-passing');
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    await user.selectOptions(screen.getByLabelText('Performer'), 'other');
    await user.selectOptions(screen.getByLabelText('Direction'), 'right');
    const cell = screen.getByRole('button', { name: /Juggler 1 left beat 1 LIFT/ });
    expect(cell.querySelector('tspan')?.textContent).toBe('R');
  });

  it('shows the performer identifier as a subscript for duplicate position names', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Add performer' }));
    await user.selectOptions(screen.getByLabelText('Type'), 'individual-passing');
    await user.click(screen.getByRole('button', { name: 'Juggler 2 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    const cell = screen.getByRole('button', { name: 'Juggler 2 left beat 1 LIFT A(b)' });
    expect(cell.querySelector('text')?.textContent).toBe('A(b)');
  });

  it('does not print HOLD or ZIP inside the ball rectangle symbols', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'HOLD' }));
    expect(container.querySelector('.notation-cell.occupied text')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Change action' }));
    await user.click(screen.getByRole('button', { name: 'ZIP' }));
    expect(container.querySelectorAll('.notation-cell.occupied text')).toHaveLength(0);
  });

  it('shows both halves of the ZIP toolbar symbol', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    const zip = screen.getByRole('button', { name: 'ZIP' });
    expect(zip.querySelectorAll('.zip-tool-preview .notation-symbol')).toHaveLength(2);
  });

  it('changes ball count and rejects reducing a ball that is in use', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const ballControl = () => Array.from(container.querySelectorAll('.setting-control')).find((element) => element.textContent?.includes('Balls'))!;
    await user.click(ballControl().querySelectorAll('button')[1]!);
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B, occupied' })).toBeInTheDocument();
    await user.click(ballControl().querySelectorAll('button')[0]!);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    await user.click(ballControl().querySelectorAll('button')[1]!);
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    await user.selectOptions(screen.getByLabelText('Target'), 'position-B');
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    await user.click(ballControl().querySelectorAll('button')[0]!);
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(alert).toHaveBeenCalled();
    alert.mockRestore();
  });

  it('selects all performer rows when a beat label is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Select beat 2' }));
    expect(container.querySelectorAll('.notation-cell.selected')).toHaveLength(2);
  });

  it('extends a selection with Shift and deletes all selected cells', async () => {
    const user = userEvent.setup();
    render(<App />);
    const first = screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' });
    await user.click(first);
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    const second = screen.getByRole('button', { name: 'Juggler 1 left beat 2 empty' });
    fireEvent.keyDown(second, { key: 'ArrowRight', shiftKey: true });
    await user.click(screen.getByRole('button', { name: 'HOLD' }));
    fireEvent.keyDown(second, { key: 'Backspace' });
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 2 empty' })).toBeInTheDocument();
  });

  it('copies and pastes notation with the explicit editor controls', async () => {
    const user = userEvent.setup();
    render(<App />);
    const first = screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' });
    await user.click(first);
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    const second = screen.getByRole('button', { name: 'Juggler 1 right beat 2 empty' });
    await user.click(second);
    await user.click(screen.getByRole('button', { name: 'Paste' }));
    expect(screen.getByRole('button', { name: 'Juggler 1 right beat 2 LIFT A' })).toBeInTheDocument();
  });

  it('erases a rectangular selection with Ctrl and drag', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 2 empty' }));
    await user.click(screen.getByRole('button', { name: 'HOLD' }));
    const first = screen.getByRole('button', { name: 'Juggler 1 left beat 1 LIFT A' });
    const second = screen.getByRole('button', { name: 'Juggler 1 left beat 2 HOLD' });
    fireEvent.mouseDown(first, { ctrlKey: true });
    fireEvent.mouseUp(second);
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 2 empty' })).toBeInTheDocument();
  });

  it('inserts a beat after the selected timeline column', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Insert beat after 1' }));
    expect(screen.getByRole('button', { name: 'Select beat 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 9 empty' })).toBeInTheDocument();
  });

  it('moves an entire ball rectangle when dragging one of its cells', () => {
    render(<App />);
    const start = screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' });
    const end = screen.getByRole('button', { name: 'Juggler 1 left beat 3 empty' });
    fireEvent.mouseDown(start, { shiftKey: true });
    fireEvent.mouseUp(end);
    const hold = screen.getByRole('button', { name: 'Juggler 1 left beat 2 HOLD' });
    const destination = screen.getByRole('button', { name: 'Juggler 1 left beat 3 LEAVE A' });
    fireEvent.mouseDown(hold);
    fireEvent.mouseUp(destination);
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 2 LIFT A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 3 HOLD' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 4 LEAVE A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' })).toBeInTheDocument();
  });

  it('keeps linked SPECIAL text synchronised when either side is edited', async () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Clap twice');
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'CLAP' }));
    const right = screen.getByRole('button', { name: 'Juggler 1 right beat 1 Clap' });
    fireEvent.contextMenu(right);
    expect(prompt).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 Clap twice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 right beat 1 Clap twice' })).toBeInTheDocument();
    prompt.mockRestore();
  });

  it('splits timeline intervals recursively and labels conventional counts', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Subdivide beat 1 interval 1' }));
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 & empty' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Subdivide beat 1 interval 1' }));
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 e empty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 & empty' })).toBeInTheDocument();
    expect(screen.getByText(/simulator currently evaluates all actions/)).toBeInTheDocument();
  });

  it('adds notation at the selected subdivision offset', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Subdivide beat 1 interval 1' }));
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 & empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 & LIFT A' })).toBeInTheDocument();
  });

  it('moves a beat together with its notation and subdivision structure', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    await user.click(screen.getByRole('button', { name: 'Move beat 2 left' }));
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 2 LIFT A' })).toBeInTheDocument();
  });

  it('allows performer names and identifiers to be edited', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const name = screen.getByRole('textbox', { name: 'Performer name Juggler 1' });
    await user.clear(name);
    await user.type(name, 'Oliver');
    fireEvent.blur(name);
    expect(screen.getAllByText('Oliver')).toHaveLength(2);
    const identifier = screen.getByRole('textbox', { name: 'Performer identifier a' });
    await user.clear(identifier);
    await user.type(identifier, 'z');
    fireEvent.blur(identifier);
    expect(screen.getByText('z')).toBeInTheDocument();
  });

  it('moves multiple selected ball rectangles together', () => {
    render(<App />);
    const draw = (startName: string, endName: string) => {
      fireEvent.mouseDown(screen.getByRole('button', { name: startName }), { shiftKey: true });
      const end = screen.getByRole('button', { name: endName });
      fireEvent.mouseUp(end);
      fireEvent.click(end);
    };
    draw('Juggler 1 left beat 1 empty', 'Juggler 1 left beat 2 empty');
    draw('Juggler 1 left beat 4 empty', 'Juggler 1 left beat 5 empty');
    const first = screen.getByRole('button', { name: 'Juggler 1 left beat 1 LIFT A' });
    fireEvent.click(first);
    fireEvent.keyDown(first, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(first, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(first, { key: 'ArrowRight', shiftKey: true });
    fireEvent.mouseDown(first);
    fireEvent.mouseUp(screen.getByRole('button', { name: 'Juggler 1 left beat 2 LEAVE A' }));
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 2 LIFT A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 3 LEAVE A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 5 LIFT A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 6 LEAVE A' })).toBeInTheDocument();
  });

  it('moves both linked ZIP halves with the complete ball rectangle', () => {
    render(<App />);
    const start = screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' });
    const end = screen.getByRole('button', { name: 'Juggler 1 right beat 4 empty' });
    fireEvent.mouseDown(start, { shiftKey: true });
    fireEvent.mouseUp(end);
    const zipSource = screen.getByRole('button', { name: 'Juggler 1 left beat 2 ZIP ↗' });
    const next = screen.getByRole('button', { name: 'Juggler 1 left beat 3 empty' });
    fireEvent.mouseDown(zipSource);
    fireEvent.mouseUp(next);
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 2 LIFT A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 3 ZIP ↗' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 right beat 3 ZIP ↙' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 right beat 4 HOLD' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 right beat 5 LEAVE A' })).toBeInTheDocument();
  });

  it('moves an individual pass together with both linked performer entries', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Add performer' }));
    await user.selectOptions(screen.getByLabelText('Type'), 'individual-passing');
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 2 empty' }));
    await user.click(screen.getByRole('button', { name: 'HOLD' }));
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 3 empty' }));
    await user.click(screen.getByRole('button', { name: 'PASS' }));
    const hold = screen.getByRole('button', { name: 'Juggler 1 left beat 2 HOLD' });
    const leave = screen.getByRole('button', { name: /Juggler 1 left beat 3 LEAVE/ });
    fireEvent.mouseDown(hold);
    fireEvent.mouseUp(leave);
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 2 LIFT A(a)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 3 HOLD' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Juggler 1 left beat 4 LEAVE/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Juggler 2 left beat 4 LIFT X/ })).toBeInTheDocument();
  });

  it('supports tap based drawing, moving and erasing for touch layouts', () => {
    const { container } = render(<App />);
    const mode = (name: string) => Array.from(container.querySelectorAll('.mode-tool')).find((button) => button.textContent === name)!;
    fireEvent.click(mode('Draw'));
    fireEvent.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    fireEvent.click(screen.getByRole('button', { name: 'Juggler 1 left beat 3 empty' }));
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 LIFT A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 3 LEAVE A' })).toBeInTheDocument();

    fireEvent.click(mode('Move'));
    fireEvent.click(screen.getByRole('button', { name: 'Juggler 1 left beat 2 HOLD' }));
    fireEvent.click(screen.getByRole('button', { name: 'Juggler 1 left beat 3 LEAVE A' }));
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 2 LIFT A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 3 HOLD' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 4 LEAVE A' })).toBeInTheDocument();

    fireEvent.click(mode('Erase'));
    fireEvent.click(screen.getByRole('button', { name: 'Juggler 1 left beat 2 LIFT A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Juggler 1 left beat 4 LEAVE A' }));
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 2 empty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 4 empty' })).toBeInTheDocument();
  });

  it('supports multi selection by tapping cells on touch layouts', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 2 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    const select = Array.from(container.querySelectorAll('.mode-tool')).find((button) => button.textContent === 'Select')!;
    fireEvent.click(select);
    fireEvent.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 LIFT A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Juggler 1 left beat 2 LIFT A' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 2 empty' })).toBeInTheDocument();
  });

  it('deletes both sides of an individual passing pair together', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Add performer' }));
    await user.selectOptions(screen.getByLabelText('Type'), 'individual-passing');
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'PASS' }));
    const receiver = screen.getByRole('button', { name: /Juggler 2 left beat 1 LIFT X/ });
    await user.click(receiver);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 2 left beat 1 empty' })).toBeInTheDocument();
  });

  it('opens the action menu for an empty cell and closes it after choosing an action', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByRole('button', { name: 'LIFT' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    expect(screen.getByRole('button', { name: 'LIFT' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    expect(screen.queryByRole('button', { name: 'LIFT' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Change action' }));
    expect(screen.getByRole('button', { name: 'HOLD' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'HOLD' }));
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 HOLD' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'HOLD' })).not.toBeInTheDocument();
  });

  it('supports action shortcuts and exposes the keyboard reference', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    fireEvent.keyDown(screen.getByRole('main', { name: 'POINTS Workspace' }), { key: '1' });
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 LIFT A' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('main', { name: 'POINTS Workspace' }), { key: '?' });
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    expect(screen.getByText('Insert LIFT, HOLD, LEAVE, BOUNCE, TAP, EMPTY, ZIP or SPECIAL')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('main', { name: 'POINTS Workspace' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });

  it('copies and pastes selected notation with keyboard shortcuts and supports keyboard undo', () => {
    render(<App />);
    const main = screen.getByRole('main', { name: 'POINTS Workspace' });
    fireEvent.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    fireEvent.keyDown(main, { key: '1' });
    fireEvent.keyDown(main, { key: 'c', ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Juggler 1 left beat 3 empty' }));
    fireEvent.keyDown(main, { key: 'v', ctrlKey: true });
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 3 LIFT A' })).toBeInTheDocument();
    fireEvent.keyDown(main, { key: 'z', ctrlKey: true });
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 3 empty' })).toBeInTheDocument();
    fireEvent.keyDown(main, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 3 LIFT A' })).toBeInTheDocument();
  });


  it('sets table position targets by typing their labels', () => {
    render(<App />);
    const main = screen.getByRole('main', { name: 'POINTS Workspace' });
    fireEvent.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    fireEvent.keyDown(main, { key: '1' });
    fireEvent.keyDown(main, { key: 'B' });
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 LIFT B' })).toBeInTheDocument();
  });



  it('navigates to the exact subdivision cell from a validation issue', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Subdivide beat 1 interval 1' }));
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 & empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    await user.selectOptions(screen.getByLabelText('Target'), 'position-B');

    expect(screen.queryByText('Sequence valid')).not.toBeInTheDocument();
    const invalidCell = screen.getByRole('button', { name: 'Juggler 1 left beat 1 & LIFT B' });
    expect(invalidCell).toHaveClass('invalid');

    await user.click(screen.getAllByRole('button', { name: 'Go to' })[0]!);
    expect(invalidCell).toHaveClass('selected');
  });

  it('copies and pastes both linked ZIP symbols as one structure', async () => {
    const user = userEvent.setup();
    render(<App />);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }), { shiftKey: true });
    fireEvent.mouseUp(screen.getByRole('button', { name: 'Juggler 1 right beat 4 empty' }));

    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 2 ZIP ↗' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 5 empty' }));
    await user.click(screen.getByRole('button', { name: 'Paste' }));

    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 5 ZIP ↗' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 right beat 5 ZIP ↙' })).toBeInTheDocument();
  });

  it('rejects a conflicting paste without partially changing the sequence', async () => {
    const user = userEvent.setup();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 2 empty' }));
    await user.click(screen.getByRole('button', { name: 'HOLD' }));
    await user.click(screen.getByRole('button', { name: 'Paste' }));

    expect(alert).toHaveBeenCalledWith('Paste cancelled because one or more destination cells are occupied.');
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 LIFT A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 2 HOLD' })).toBeInTheDocument();
    alert.mockRestore();
  });

  it('restores and reapplies an edit with undo and redo', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    await user.click(screen.getByTitle('Undo'));
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' })).toBeInTheDocument();

    await user.click(screen.getByTitle('Redo'));
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 LIFT A' })).toBeInTheDocument();
  });

  it('does not trigger notation shortcuts while a settings input is focused', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const bpm = screen.getByRole('spinbutton');
    bpm.focus();
    await user.keyboard('1');

    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' })).toBeInTheDocument();
  });
});
