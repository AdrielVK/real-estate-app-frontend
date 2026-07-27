import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { AiSearchDialog } from '@/components/public/AiSearchDialog';

describe('AiSearchDialog', () => {
  // DIALOG-IA-1: heading + helper copy render when open.
  it('renders the heading and helper copy when open (DIALOG-IA-1)', () => {
    render(<AiSearchDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Buscar con IA' })).toBeInTheDocument();
    expect(
      screen.getByText(/describí la propiedad como se la contarías a un asesor/i),
    ).toBeInTheDocument();
  });

  // DIALOG-IA-1: the textarea is reachable with the new v0 placeholder.
  it('renders the search textarea with the v0 placeholder (DIALOG-IA-1)', () => {
    render(<AiSearchDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/depto de 2 ambientes con balcón/i)).toBeInTheDocument();
  });

  // Example prompts render and fill the textarea on click.
  it('renders example chips and fills the textarea on click', () => {
    render(<AiSearchDialog open onOpenChange={vi.fn()} />);
    const chip = screen.getByText(/casa con patio y espacio para dos autos/i);
    expect(chip).toBeInTheDocument();

    fireEvent.click(chip);
    const textarea = screen.getByPlaceholderText(
      /depto de 2 ambientes con balcón/i,
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Casa con patio y espacio para dos autos en zona norte');
  });

  // DIALOG-IA-2: Cancelar button closes the dialog.
  it('calls onOpenChange(false) when the "Cancelar" button is clicked (DIALOG-IA-2)', () => {
    const onOpenChange = vi.fn();
    render(<AiSearchDialog open onOpenChange={onOpenChange} />);
    // Cancelar is hidden on mobile (sm:inline-flex), but still in the DOM
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // DIALOG-IA-2: the X close button works.
  it('calls onOpenChange(false) when the corner X button is clicked (DIALOG-IA-2)', () => {
    const onOpenChange = vi.fn();
    render(<AiSearchDialog open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // DIALOG-IA-3: no real fetch/network in source.
  it('does not import fetch or any network primitive (DIALOG-IA-3 guard)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/public/AiSearchDialog.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\baxios\b/);
    expect(source).not.toMatch(/\bXMLHttpRequest\b/);
  });

  // Validation: short text shows error.
  it('shows error when text is shorter than 6 characters', async () => {
    render(<AiSearchDialog open onOpenChange={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(
      /depto de 2 ambientes con balcón/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Casa' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));

    expect(await screen.findByText(/contanos un poco más/i)).toBeInTheDocument();
  });

  // Validation: short text shows error.
  it('shows error when text is shorter than 6 characters', async () => {
    render(<AiSearchDialog open onOpenChange={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(
      /depto de 2 ambientes con balcón/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Casa' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));

    expect(await screen.findByText(/contanos un poco más/i)).toBeInTheDocument();
  });
});
