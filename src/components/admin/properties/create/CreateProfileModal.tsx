/**
 * `CreateProfileModal` — title-only stub dialog for the profile
 * comboboxes' `+` action (REQ-103/S5).
 *
 * The backend has no create-profile endpoint yet, so the modal's whole
 * job today is proving the open/close plumbing: native `<dialog>`
 * focus trap, Escape dismissal and the focus-return contract that
 * `ProfileCombobox` implements around it. When the endpoint lands, the
 * form controls go here — nothing else changes.
 */

'use client';

import { useId } from 'react';

import { Dialog } from '@/components/ui/Dialog';

export interface CreateProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Crear agente" | "Crear propietario" — also the accessible name. */
  title: string;
}

export function CreateProfileModal({ open, onOpenChange, title }: CreateProfileModalProps) {
  const titleId = useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange} labelledBy={titleId}>
      <h2 id={titleId} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {/* Stub on purpose (REQ-103): title-only until the backend
          profile-creation endpoint exists. */}
    </Dialog>
  );
}
