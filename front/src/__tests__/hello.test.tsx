import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Hello-world front test — confirms the jsdom + RTL + jest-dom pipeline is
 * wired correctly without depending on any specific app component.
 */
function Hello({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>;
}

describe('hello (front)', () => {
  it('renders a greeting', () => {
    render(<Hello name="Starteria" />);
    expect(screen.getByRole('heading')).toHaveTextContent('Hello, Starteria!');
  });
});
