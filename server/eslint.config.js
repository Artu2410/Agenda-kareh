import globals from 'globals';

// Red mínima para el servidor: detecta nombres sin definir o sin importar
// (por ejemplo, una constante movida a otro módulo y no importada).
export default [
  { ignores: ['node_modules/**', 'coverage/**', 'uploads/**', 'data/**'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      'no-undef': 'error',
    },
  },
];
