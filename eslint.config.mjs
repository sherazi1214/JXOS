import nextConfig from 'eslint-config-next';

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...nextConfig,
  {
    rules: {
      'no-unused-vars': 'warn',
      // This rule (bundled with eslint-config-next 16's React Compiler
      // ruleset) flags the standard "fetch on mount / fetch when a filter
      // changes" and "reset form fields when a modal opens" effects used
      // throughout this app — both are patterns React's own docs
      // recommend. Downgraded to a warning rather than rewritten wholesale,
      // since a blanket rewrite across ~35 files carries real regression
      // risk with no functional upside.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default eslintConfig;
