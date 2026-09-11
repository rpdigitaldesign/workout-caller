import nextConfig from 'eslint-config-next';

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...nextConfig,
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'coverage/**', 'public/sw.js'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];

export default eslintConfig;
