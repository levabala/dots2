// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        rules: {
            "@typescript-eslint/strict-boolean-expressions": "error",
            "@typescript-eslint/no-unused-vars": "off",
        },
    },
);
