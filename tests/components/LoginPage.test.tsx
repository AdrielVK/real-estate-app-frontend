import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LoginPage from '@/app/(public)/login/page';

describe('LoginPage', () => {
  it('renders the login form and account links', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toHaveClass(
      'cursor-pointer',
    );
    expect(screen.getByRole('link', { name: 'Crear Cuenta' })).toHaveAttribute('href', '/registro');
    expect(screen.queryByText('Casal Propiedades')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'Accedé a tu cuenta para seguir buscando el lugar que querés llamar hogar.',
      ),
    ).not.toBeInTheDocument();
  });

  it('renders the desktop brand panel as a mobile-hidden complementary region', () => {
    render(<LoginPage />);

    const brandPanel = screen.getByRole('complementary', {
      name: 'Encontrá tu próximo hogar',
      hidden: true,
    });

    expect(brandPanel).toHaveClass('login-photo-panel', 'hidden', 'md:flex');
    expect(brandPanel.parentElement).toHaveClass('login-split-layout');
    expect(screen.getByRole('heading', { name: /Encontrá el lugar/ })).toBeInTheDocument();
    const image = brandPanel.querySelector('img');
    expect(image).toHaveAttribute('src', expect.stringContaining('login-1.webp'));
    expect(image).toHaveAttribute('sizes', '(min-width: 768px) 50vw, 0px');
    expect(image).toHaveClass('login-photo-image', 'object-cover', 'object-[0%_100%]');
    expect(brandPanel.querySelector('.login-photo-mask')).toHaveClass('-inset-x-4', '-inset-y-10');
    expect(brandPanel.querySelector('svg')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continuar con Google' }).querySelector('svg'),
    ).toBeInTheDocument();
  });

  it('keeps the form after the photo panel on desktop', () => {
    render(<LoginPage />);

    const complementary = screen.getByRole('complementary', {
      name: 'Encontrá tu próximo hogar',
      hidden: true,
    });
    const form = complementary.parentElement?.querySelector('form');

    expect(form).not.toBeNull();
    expect(
      complementary.compareDocumentPosition(form as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
