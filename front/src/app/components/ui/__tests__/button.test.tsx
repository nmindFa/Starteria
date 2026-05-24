import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, buttonVariants } from '../button';

describe('Button', () => {
  it('renders a native button by default and passes through children', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('data-slot', 'button');
  });

  it('forwards onClick handler and respects disabled prop', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Disabled
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    const user = userEvent.setup();
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('triggers onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders as child element when asChild is true (Slot)', () => {
    render(
      <Button asChild>
        <a href="/x">Linkish</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Linkish' });
    expect(link).toHaveAttribute('href', '/x');
    expect(link).toHaveAttribute('data-slot', 'button');
  });

  it('applies variant + size classes via buttonVariants', () => {
    const cls = buttonVariants({ variant: 'destructive', size: 'lg' });
    expect(cls).toMatch(/bg-destructive/);
    expect(cls).toMatch(/h-10/);
  });

  it('merges custom className with variant classes', () => {
    render(
      <Button className="custom-cls" variant="outline">
        x
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/custom-cls/);
  });
});
