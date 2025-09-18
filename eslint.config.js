import js from '@eslint/js'
import globals from 'globals'

import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'
import { useEffect, useMemo, useRef, useState } from "react";
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
