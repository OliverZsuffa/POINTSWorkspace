import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('sequence editor', () => {
  it('renders the workspace and notation editor', () => {
    render(<App />);
    expect(screen.getByRole('main', { name: 'POINTS Workspace' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Notation editor' })).toBeInTheDocument();
    expect(screen.getByText('Validation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LIFT' })).toBeInTheDocument();
  });
});
