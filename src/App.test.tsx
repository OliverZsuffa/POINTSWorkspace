import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('application entry point', () => {
  it('renders the workspace main landmark', () => {
    render(<App />);
    expect(
      screen.getByRole('main', { name: 'POINTS Workspace' }),
    ).toBeInTheDocument();
  });
});
