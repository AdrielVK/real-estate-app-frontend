'use client';

import { useState } from 'react';

import Link from 'next/link';

import { cn } from '@/lib/utils';

export interface MobileNavLink {
  href: string;
  label: string;
}

export interface MobileNavProps {
  links: readonly MobileNavLink[];
  className?: string;
}

/**
 * `MobileNav` — the only client island in the public zone.
 * Renders a hamburger toggle that opens a vertical menu. All other
 * components stay server-rendered.
 */
export function MobileNav({ links, className }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('md:hidden', className)}>
      <button
        type="button"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
        aria-controls="mobile-nav-menu"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center justify-center p-2"
      >
        <span aria-hidden="true">{open ? '✕' : '☰'}</span>
      </button>
      {open ? (
        <nav
          id="mobile-nav-menu"
          aria-label="Navegación principal"
          className="absolute left-0 right-0 top-full flex flex-col gap-1 border-t border-border p-4"
        >
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="py-2 text-base">
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
