export default {
  '*.{ts,mjs,js,svelte}': ['eslint --max-warnings=0 --fix', 'prettier --write'],
  '*.{css,html,json,md}': 'prettier --write',
};
