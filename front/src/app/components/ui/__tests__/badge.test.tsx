import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, badgeVariants } from '../badge';

describe('Badge', () => {
  it('renders as span by default with the data-slot attribute', () => {
    render(<Badge>Hi</Badge>);
    const el = screen.getByText('Hi');
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveAttribute('data-slot', 'badge');
  });

  it('exposes the requested variant class', () => {
    render(
      <Badge variant="destructive" className="extra">
        Danger
      </Badge>,
    );
    const el = screen.getByText('Danger');
    expect(el.className).toMatch(/bg-destructive/);
    expect(el.className).toMatch(/extra/);
  });

  it('renders as child element when asChild is true', () => {
    render(
      <Badge asChild>
        <a href="/x">Linkish</a>
      </Badge>,
    );
    const link = screen.getByRole('link', { name: 'Linkish' });
    expect(link).toHaveAttribute('data-slot', 'badge');
  });

  it('badgeVariants returns class strings for known variants', () => {
    expect(badgeVariants({ variant: 'default' })).toMatch(/bg-primary/);
    expect(badgeVariants({ variant: 'secondary' })).toMatch(/bg-secondary/);
    expect(badgeVariants({ variant: 'outline' })).toMatch(/text-foreground/);
  });
});
