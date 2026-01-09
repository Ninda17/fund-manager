import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'logs/**', '*.log', 'eslint.config.*'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'script',
      },
    },
    rules: {
      // Code Syntax - Prevent broken JS code
      'no-undef': 'error', // Detect undefined variables
      'no-unreachable': 'error', // Detect unreachable code
      'no-unused-expressions': ['error', {
        allowShortCircuit: true, // Allow: condition && expression
        allowTernary: true // Allow: condition ? true : false
      }], // Detect unused expressions
      'no-func-assign': 'error', // Prevent function re-assignment
      
      // Unused Variables / Functions - Clean code, no dead code
      'no-unused-vars': ['error', { 
        argsIgnorePattern: '^_', // Allow unused args starting with _
        varsIgnorePattern: '^_', // Allow unused vars starting with _
        caughtErrorsIgnorePattern: '^_', // Allow unused catch clause vars starting with _
        ignoreRestSiblings: true // Allow unused rest siblings
      }],
      
      // Code Quality
      'no-console': 'off', // Allow console statements in Node.js backend
    },
  },
];
