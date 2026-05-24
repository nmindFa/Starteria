import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from '../label';

describe('Label', () => {
  it('renders text children with the data-slot attribute', () => {
    render(<Label>Email</Label>);
    const el = screen.getByText('Email');
    expect(el).toHaveAttribute('data-slot', 'label');
  });

  it('forwards htmlFor prop to associate with controls', () => {
    render(
      <>
        <Label htmlFor="email-input">Email</Label>
        <input id="email-input" />
      </>,
    );
    const label = screen.getByText('Email');
    expect(label.getAttribute('for')).toBe('email-input');
  });

  it('merges custom className', () => {
    render(<Label className="custom-cls">X</Label>);
    expect(screen.getByText('X').className).toMatch(/custom-cls/);
  });
});
