import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Code Syntax - Prevent broken JS/React code
      'no-undef': 'error', // Detect undefined variables
      'no-unreachable': 'error', // Detect unreachable code
      'no-unused-expressions': ['error', { 
        allowShortCircuit: true, // Allow: condition && expression
        allowTernary: true, // Allow: condition ? true : false
        allowTaggedTemplates: true // Allow tagged templates
      }], // Detect unused expressions
      'no-func-assign': 'error', // Prevent function re-assignment
      
      // Unused Variables / Functions - Clean code, no dead code
      'no-unused-vars': ['error', { 
        varsIgnorePattern: '^[A-Z_]', // Allow constants (UPPERCASE) and _prefixed vars
        argsIgnorePattern: '^_', // Allow unused args starting with _
        caughtErrorsIgnorePattern: '^_', // Allow unused catch clause vars starting with _
        ignoreRestSiblings: true // Allow unused rest siblings
      }],
      
      // React Rules - useEffect dependencies & context rules
      'react-hooks/rules-of-hooks': 'error', // Enforce hooks rules
      'react-hooks/exhaustive-deps': 'error', // Enforce useEffect dependencies
      'react-refresh/only-export-components': ['warn', { 
        allowConstantExport: true // Allow context exports (like UserContext)
      }],
    },
  },
])
