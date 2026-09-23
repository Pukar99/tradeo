import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      // Classic react-hooks rules only — v7 expanded rules are too strict for existing code
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Disable all new v7 react-hooks rules (immutability, purity, set-state-in-effect, etc.)
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/config': 'off',
      'react-hooks/gating': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react/jsx-no-target-blank': 'off',
      // Security: block dangerouslySetInnerHTML — the app currently has ZERO uses,
      // and rendering model/user content as raw HTML is the main DOM-XSS vector.
      // If a real need ever arises, sanitize with DOMPurify and disable per-line
      // with an explanatory comment.
      'react/no-danger': 'error',
      // project does not use PropTypes
      'react/prop-types': 'off',
      // apostrophes in UI text are intentional
      'react/no-unescaped-entities': 'off',
      // no-undef has false positives in JSX — downgrade to warn
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // intentional empty catches are common
      'no-empty': ['error', { allowEmptyCatch: true }],
      // jsx-a11y recommended rules at warn level globally (existing code = visible debt, never a broken build)
      ...Object.entries(jsxA11y.configs.recommended.rules).reduce((acc, [rule, _level]) => {
        acc[rule] = 'warn'
        return acc
      }, {}),
    },
  },
  {
    files: ['tests/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.jest },
    },
  },
  // Settings scope: jsx-a11y at error level + Gate-3 meroshare import ban
  {
    files: ['src/pages/SettingsPage.jsx', 'src/components/settings/**/*.jsx'],
    plugins: {
      'jsx-a11y': jsxA11y,
    },
    rules: {
      // jsx-a11y recommended rules at error level for Settings
      ...Object.entries(jsxA11y.configs.recommended.rules).reduce((acc, [rule, _level]) => {
        acc[rule] = 'error'
        return acc
      }, {}),
      // Gate-3 security boundary: Settings must never touch MeroShare data
      'no-restricted-syntax': ['error', {
        selector: "ImportSpecifier[imported.name=/[Mm]eroshare/]",
        message: "Gate-3: Settings must never touch MeroShare data (decrypted credentials in response)",
      }],
    },
  },
]
