import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { AiSearchDialog } from '@/components/public/AiSearchDialog';

describe('AiSearchDialog', () => {
  // DIALOG-IA-1: opens via the parent prop, heading + copy render.
  it('renders the heading and helper copy when open (DIALOG-IA-1)', () => {
    render(<AiSearchDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Buscar con IA' })).toBeInTheDocument();
    expect(screen.getByText(/describí en tus palabras el tipo de propiedad/i)).toBeInTheDocument();
  });

  // DIALOG-IA-1: the textarea placeholder is reachable.
  it('renders the search textarea with a placeholder (DIALOG-IA-1)', () => {
    render(<AiSearchDialog open onOpenChange={vi.fn()} />);
    expect(
      screen.getByPlaceholderText(/describí el tipo de propiedad que buscás/i),
    ).toBeInTheDocument();
  });

  // DIALOG-IA-2: Cancelar + Buscar buttons close the dialog.
  it('calls onOpenChange(false) when the "Cancelar" button is clicked (DIALOG-IA-2)', () => {
    const onOpenChange = vi.fn();
    render(<AiSearchDialog open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when the "Buscar" button is clicked (DIALOG-IA-2)', () => {
    const onOpenChange = vi.fn();
    render(<AiSearchDialog open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // DIALOG-IA-2: the explicit close button in the corner also works.
  it('calls onOpenChange(false) when the corner X button is clicked (DIALOG-IA-2)', () => {
    const onOpenChange = vi.fn();
    render(<AiSearchDialog open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // DIALOG-IA-3: no fetch / no network. The component is read-only —
  // it accepts text input but does not dispatch any network call on
  // submit. We assert that by looking for the "coming soon" hint
  // and by ensuring `Buscar` only calls onOpenChange.
  it('shows the "coming soon" hint instead of firing a real search (DIALOG-IA-3)', () => {
    const onOpenChange = vi.fn();
    render(<AiSearchDialog open onOpenChange={onOpenChange} />);
    expect(
      screen.getByText(/la búsqueda con ia estará disponible próximamente/i),
    ).toBeInTheDocument();

    // Type into the textarea — the value should change but no
    // fetch-like side effect should fire. We assert that the
    // "Buscar" click only closes the dialog (no extra args).
    const textarea = screen.getByPlaceholderText(
      /describí el tipo de propiedad que buscás/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Depto luminoso con balcón' } });
    expect(textarea.value).toBe('Depto luminoso con balcón');

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // DIALOG-IA-3: no fetch / network primitives in the source.
  it('does not import fetch or any network primitive (DIALOG-IA-3 guard)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/public/AiSearchDialog.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\baxios\b/);
    expect(source).not.toMatch(/\bXMLHttpRequest\b/);
  });
});
