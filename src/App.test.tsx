import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('renders notation using the POINTS symbol geometry', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' }));
    await user.click(screen.getByRole('button', { name: 'LIFT' }));

    const symbol = screen.getByRole('button', { name: 'Juggler 1 left beat 1 LIFT A' }).querySelector('svg.ball-segment');
    expect(symbol).toBeInTheDocument();
    expect(symbol).toHaveAttribute('viewBox', '0 0 100 100');
    expect(symbol?.querySelector('path')).toHaveAttribute('d', 'M0 19H100 M0 19V81 M0 81H100');
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
    expect(screen.getAllByLabelText('Hand')).toHaveLength(2);
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

  it('shows both halves of the ZIP toolbar symbol', () => {
    render(<App />);
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
    fireEvent.keyDown(second, { key: 'Delete' });
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juggler 1 left beat 2 empty' })).toBeInTheDocument();
  });

  it('copies and pastes notation with the keyboard', async () => {
    const user = userEvent.setup();
    render(<App />);
    const first = screen.getByRole('button', { name: 'Juggler 1 left beat 1 empty' });
    await user.click(first);
    await user.click(screen.getByRole('button', { name: 'LIFT' }));
    fireEvent.keyDown(first, { key: 'c', ctrlKey: true });
    const second = screen.getByRole('button', { name: 'Juggler 1 right beat 2 empty' });
    await user.click(second);
    fireEvent.keyDown(second, { key: 'v', ctrlKey: true });
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
    fireEvent.doubleClick(right);
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
    expect(screen.getByText('Oliver')).toBeInTheDocument();
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
      fireEvent.mouseUp(screen.getByRole('button', { name: endName }));
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
});
