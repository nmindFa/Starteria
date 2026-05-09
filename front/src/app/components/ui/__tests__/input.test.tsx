import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../input';

describe('Input', () => {
  it('renders an input element with data-slot=input', () => {
    render(<Input aria-label="email" />);
    const el = screen.getByLabelText('email');
    expect(el.tagName).toBe('INPUT');
    expect(el).toHaveAttribute('data-slot', 'input');
  });

  it('forwards type and value props', () => {
    render(<Input aria-label="pw" type="password" defaultValue="secret" />);
    const el = screen.getByLabelText('pw') as HTMLInputElement;
    expect(el.type).toBe('password');
    expect(el.value).toBe('secret');
  });

  it('accepts user typing', async () => {
    render(<Input aria-label="text" />);
    const user = userEvent.setup();
    const el = screen.getByLabelText('text') as HTMLInputElement;
    await user.type(el, 'hello');
    expect(el.value).toBe('hello');
  });

  it('forwards className and aria-invalid', () => {
    render(<Input aria-label="x" className="my-cls" aria-invalid="true" />);
    const el = screen.getByLabelText('x');
    expect(el.className).toMatch(/my-cls/);
    expect(el).toHaveAttribute('aria-invalid', 'true');
  });

  it('respects disabled prop', () => {
    render(<Input aria-label="x" disabled />);
    expect(screen.getByLabelText('x')).toBeDisabled();
  });
});
