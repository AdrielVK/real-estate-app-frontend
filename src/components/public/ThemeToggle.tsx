'use client';

import { useEffect, useReducer } from 'react';

import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/Button';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'casal-theme';

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme === 'light');
}

export function ThemeToggle() {
  const [theme, setTheme] = useReducer((_: Theme, nextTheme: Theme) => nextTheme, 'light');

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);
    const hasStoredTheme = storedTheme === 'light' || storedTheme === 'dark';
    const initialTheme = hasStoredTheme ? storedTheme : getSystemTheme();

    setTheme(initialTheme);
    applyTheme(initialTheme);

    if (hasStoredTheme) return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      const nextTheme = event.matches ? 'dark' : 'light';
      setTheme(nextTheme);
      applyTheme(nextTheme);
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  function toggleTheme() {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  }

  return (
    <Button
      variant="outline"
      size="icon-lg"
      className="size-9 rounded-full"
      role="switch"
      aria-checked={theme === 'dark'}
      aria-label={nextTheme === 'dark' ? 'Activar modo oscuro' : 'Activar modo claro'}
      onClick={toggleTheme}
    >
      {theme === 'dark' ? <Moon aria-hidden className="size-4" /> : <Sun aria-hidden className="size-4" />}
    </Button>
  );
}
