import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { Dialog } from '@/components/ui/Dialog';

describe('Dialog', () => {
  // DIALOG-1: open attribute is reflected on the underlying <dialog>.
  it('renders the <dialog> with the open attribute when open=true (DIALOG-1, A5)', () => {
    render(
      <Dialog open onOpenChange={vi.fn()}>
        body
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    // jsdom 29+ does not implement showModal() — the component falls
    // back to setting the `open` property, which reflects into the
    // attribute. Real browsers get showModal() and end up with the
    // same attribute.
    expect(dialog).toHaveAttribute('open');
  });

  it('does not set the open attribute when open=false (DIALOG-1)', () => {
    const { container } = render(
      <Dialog open={false} onOpenChange={vi.fn()}>
        body
      </Dialog>,
    );
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(false);
  });

  it('removes the open attribute when the parent flips open to false (DIALOG-1)', () => {
    const { container, rerender } = render(
      <Dialog open onOpenChange={vi.fn()}>
        body
      </Dialog>,
    );
    const before = container.querySelector('dialog');
    expect(before).toHaveAttribute('open');

    rerender(
      <Dialog open={false} onOpenChange={vi.fn()}>
        body
      </Dialog>,
    );
    const after = container.querySelector('dialog');
    expect(after?.hasAttribute('open')).toBe(false);
  });

  // DIALOG-2: aria-modal reflects the open state.
  it('sets aria-modal="true" when open (DIALOG-2)', () => {
    render(
      <Dialog open onOpenChange={vi.fn()}>
        body
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('forwards aria-labelledby when labelledBy is provided (DIALOG-2)', () => {
    render(
      <Dialog open onOpenChange={vi.fn()} labelledBy="title-id">
        <h2 id="title-id">Heading</h2>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'title-id');
  });

  // DIALOG-3: Escape key dismisses the dialog.
  it('calls onOpenChange(false) when Escape is pressed (DIALOG-3)', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        body
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not call onOpenChange on non-Escape keys (DIALOG-3)', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        body
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Enter' });
    fireEvent.keyDown(dialog, { key: 'a' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  // DIALOG-4: click on the backdrop (the <dialog> itself) dismisses.
  it('calls onOpenChange(false) when the dialog backdrop is clicked (DIALOG-4)', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        body
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    // When fireEvent.mouseDown is dispatched on the dialog element,
    // `event.target` is the dialog itself, matching `event.currentTarget`.
    // That's the exact condition our handler checks.
    fireEvent.mouseDown(dialog);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does NOT dismiss when mousedown bubbles from an inner child (DIALOG-4)', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <button type="button">inner</button>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    const inner = screen.getByRole('button', { name: 'inner' });
    // Mousedown originating on the inner button bubbles to the dialog,
    // but `event.target` is the inner button, not the dialog.
    fireEvent.mouseDown(inner);
    expect(onOpenChange).not.toHaveBeenCalled();
    // Sanity: the dialog element is still in the DOM.
    expect(dialog).toBeInTheDocument();
  });

  // Body / children rendering.
  it('renders children inside the dialog (DIALOG-2)', () => {
    render(
      <Dialog open onOpenChange={vi.fn()}>
        <p>hello world</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('hello world');
  });

  // Visual contract — ensures the styling hooks are present.
  it('applies the glass-panel, rounded-3xl, and backdrop classes (DIALOG-2)', () => {
    render(
      <Dialog open onOpenChange={vi.fn()}>
        body
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/\bglass-panel\b/);
    expect(dialog.className).toMatch(/\brounded-3xl\b/);
    expect(dialog.className).toMatch(/\bbackdrop:bg-black\/50\b/);
  });

  // Dependency guard — A5 / DIALOG-1 promises no radix / base-ui.
  it('does not import radix or base-ui headless libraries (DIALOG-1, A5 guard)', () => {
    // Read the source file directly. This is more robust than a `?raw`
    // Vite import (which has no TypeScript declarations) and makes the
    // intent obvious: we are checking the source, not the bundle.
    const source = readFileSync(resolve(process.cwd(), 'src/components/ui/Dialog.tsx'), 'utf8');
    const importLines = source.split('\n').filter((line) => /\bfrom\s+['"]/.test(line));
    for (const line of importLines) {
      expect(line, `Dialog.tsx imports a headless library: ${line.trim()}`).not.toMatch(
        /@radix-ui/,
      );
      expect(line, `Dialog.tsx imports a headless library: ${line.trim()}`).not.toMatch(/@base-ui/);
    }
  });
});
