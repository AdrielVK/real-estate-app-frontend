import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier/flat';
import prettierPlugin from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

const HEX_COLOR_PATTERN = '#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b';

/**
 * ESLint 9 flat config.
 *
 * Layer order (last-wins for overlapping rules):
 * 1. Base JS recommended
 * 2. typescript-eslint strict + stylistic (non-type-checked, decision #2)
 * 3. Next.js core-web-vitals + typescript
 * 4. SonarJS recommended quality rules
 * 5. react-hooks
 * 6. jsx-a11y
 * 7. unicorn
 * 8. simple-import-sort (custom import groups per design)
 * 9. prettier plugin
 * 10. eslint-config-prettier (turns off conflicting stylistic rules, MUST be last)
 */
export default tseslint.config(
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'node_modules/**', 'coverage/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

  ...nextVitals,
  ...nextTs,
  sonarjs.configs.recommended,

  {
    plugins: {
      // Note: react-hooks, jsx-a11y, react, import, @next/next are already
      // registered by eslint-config-next. Only add plugins NOT in that config.
      unicorn,
      'simple-import-sort': simpleImportSort,
      prettier: prettierPlugin,
    },
    languageOptions: {
      globals: {
        // Test/DOM globals
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      // react-hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // jsx-a11y (recommended set)
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/heading-has-content': 'error',
      'jsx-a11y/html-has-lang': 'error',
      'jsx-a11y/interactive-supports-focus': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',

      // unicorn — selected opinionated checks
      'unicorn/no-array-reduce': 'error',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/prefer-array-some': 'error',
      'unicorn/prefer-string-slice': 'error',
      'unicorn/prefer-ternary': 'error',
      'unicorn/throw-new-error': 'error',

      // simple-import-sort — custom groups per design:
      // side-effects → react → next → third-party →
      // @/types + @/lib → @/components → relative → .css
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // side-effect imports (e.g. `import "./globals.css"`)
            ['^\\u0000'],
            // React ecosystem
            ['^react', '^react-dom', '^react/jsx-runtime'],
            // Next.js
            ['^next', '^next/', '^@next/'],
            // Third-party packages (anything that isn't @/, react, or next, and isn't relative)
            ['^@?\\w'],
            // @/types and @/lib grouped together
            ['^@/types', '^@/lib'],
            // @/components
            ['^@/components'],
            // Relative imports
            ['^\\.'],
            // CSS side-effect imports
            ['\\.css$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',

      // Prettier integration: format issues surface as lint errors
      'prettier/prettier': 'error',

      // `void promise` is the intentional fire-and-forget convention already
      // used by event handlers and covered by TypeScript promise checks.
      'sonarjs/void-use': 'off',
    },
  },

  // Hex-color guard (decision #15) — only applied to app/component TSX
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=/${HEX_COLOR_PATTERN}/]`,
          message:
            'Hardcoded hex colors are not allowed in app/components. Use design tokens via CSS variables (e.g. bg-primary-500).',
        },
        {
          selector: `TemplateElement[value.raw=/${HEX_COLOR_PATTERN}/]`,
          message:
            'Hardcoded hex colors are not allowed in app/components. Use design tokens via CSS variables (e.g. bg-primary-500).',
        },
      ],
    },
  },

  // Test files — relax strictness that doesn't apply to test context
  {
    files: ['tests/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      'no-console': 'off',
      // Generic length assertions are useful for Testing Library collections;
      // the rule adds no signal in this test-only context.
      'sonarjs/prefer-specific-assertions': 'off',
    },
  },

  // Config files — allow Node-style syntax
  {
    files: ['*.config.{js,mjs,cjs,ts}', 'eslint.config.mjs', 'vitest.config.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // eslint-config-prettier MUST be last — disables conflicting stylistic rules
  {
    rules: {
      'prettier/prettier': 'error',
    },
  },

  prettierConfig,
);
