import { createRef } from 'react';

import { render, screen } from '@testing-library/react';

import { Button, buttonVariants } from '@/components/ui/Button';

describe('Button', () => {
  // BUTTON-1: default variant and size.
  it('renders a <button> by default with primary variant and md size (BUTTON-1)', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button.tagName).toBe('BUTTON');
    // primary variant → bg-primary class present.
    expect(button.className).toMatch(/\bbg-primary\b/);
    // md size → h-10 px-4 text-sm.
    expect(button.className).toMatch(/\bh-10\b/);
    expect(button.className).toMatch(/\bpx-4\b/);
    expect(button.className).toMatch(/\btext-sm\b/);
  });

  it('exposes buttonVariants for consumers that want to compose the same classes', () => {
    const classes = buttonVariants({ variant: 'secondary', size: 'lg' });
    expect(classes).toMatch(/\bbg-secondary\b/);
    expect(classes).toMatch(/\bh-11\b/);
  });

  // BUTTON-2: every variant applies the right utility classes.
  describe.each([
    ['primary', /\bbg-primary\b/, /\btext-primary-foreground\b/],
    ['secondary', /\bbg-secondary\b/, /\btext-secondary-foreground\b/],
    ['outline', /\bborder\b/, /\bborder-border\b/],
    ['ghost', /\bbg-transparent\b/, undefined],
  ] as const)('variant=%s', (variant, positive, negative) => {
    it(`applies the expected classes for variant=${variant} (BUTTON-2)`, () => {
      render(<Button variant={variant}>v</Button>);
      const button = screen.getByRole('button', { name: 'v' });
      if (positive) expect(button.className).toMatch(positive);
      if (negative) expect(button.className).toMatch(negative);
    });
  });

  // BUTTON-3: every size applies the right dimension classes.
  describe.each([
    ['sm', /\bh-8\b/, /\bpx-3\b/, /\btext-xs\b/],
    ['md', /\bh-10\b/, /\bpx-4\b/, /\btext-sm\b/],
    ['lg', /\bh-11\b/, /\bpx-5\b/, /\btext-sm\b/],
    ['icon-lg', /\bsize-11\b/, undefined, undefined],
  ] as const)('size=%s', (size, h, px, text) => {
    it(`applies the expected dimension classes for size=${size} (BUTTON-3)`, () => {
      render(<Button size={size}>s</Button>);
      const button = screen.getByRole('button', { name: 's' });
      if (h) expect(button.className).toMatch(h);
      if (px) expect(button.className).toMatch(px);
      if (text) expect(button.className).toMatch(text);
    });
  });

  // BUTTON-4: asChild renders the child element with merged classes.
  it('renders the child element when asChild is true (BUTTON-4)', () => {
    render(
      <Button asChild>
        <a href="/destination">Go</a>
      </Button>,
    );
    // The rendered element is the anchor, not a <button>.
    const link = screen.getByRole('link', { name: 'Go' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/destination');
    // Visual classes are forwarded to the anchor.
    expect(link.className).toMatch(/\bbg-primary\b/);
    expect(link.className).toMatch(/\bh-10\b/);
  });

  it('still forwards extra props to the asChild child', () => {
    render(
      <Button asChild variant="secondary">
        <a href="/x" data-testid="anchor">
          x
        </a>
      </Button>,
    );
    const link = screen.getByTestId('anchor');
    expect(link).toHaveAttribute('href', '/x');
    expect(link.className).toMatch(/\bbg-secondary\b/);
  });

  // BUTTON-5: base behavior — focus ring, custom className, ref, disabled.
  it('applies the focus-visible ring on the base classes (BUTTON-5)', () => {
    render(<Button>focus</Button>);
    const button = screen.getByRole('button', { name: 'focus' });
    expect(button.className).toMatch(/\bfocus-visible:ring-3\b/);
    expect(button.className).toMatch(/\bfocus-visible:ring-ring\/50\b/);
  });

  it('appends a custom className without dropping the variant classes', () => {
    render(<Button className="my-extra">c</Button>);
    const button = screen.getByRole('button', { name: 'c' });
    expect(button.className).toMatch(/\bmy-extra\b/);
    expect(button.className).toMatch(/\bbg-primary\b/);
  });

  it('forwards refs to the underlying button element (BUTTON-5)', () => {
    const ref = createRef<HTMLElement>();
    render(<Button ref={ref}>r</Button>);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('BUTTON');
  });

  it('forwards refs to the asChild child element (BUTTON-5)', () => {
    const ref = createRef<HTMLElement>();
    render(
      <Button asChild ref={ref}>
        <a href="/r">r</a>
      </Button>,
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('A');
  });

  it('applies the disabled state — attribute and visual class (BUTTON-5)', () => {
    render(<Button disabled>d</Button>);
    const button = screen.getByRole('button', { name: 'd' });
    expect(button).toBeDisabled();
    // base classes include `disabled:opacity-50` and `disabled:pointer-events-none`.
    expect(button.className).toMatch(/\bdisabled:opacity-50\b/);
    expect(button.className).toMatch(/\bdisabled:pointer-events-none\b/);
  });

  it('defaults to type="button" so accidental form submits are prevented', () => {
    render(<Button>t</Button>);
    const button = screen.getByRole('button', { name: 't' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('respects an explicit type="submit" override', () => {
    render(<Button type="submit">s</Button>);
    expect(screen.getByRole('button', { name: 's' })).toHaveAttribute('type', 'submit');
  });
});
