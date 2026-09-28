# Contributing to Yalqen

Thanks for your interest in improving Yalqen.

## Before you start

- For bugs, search [existing issues](https://github.com/YSamed/yalqen/issues) first, then open one using the bug report template.
- For larger changes or new features, open an issue to discuss the idea before writing code.
- Never report security vulnerabilities in public issues; follow [SECURITY.md](SECURITY.md).

## Development setup

Requires macOS and Node.js 24.

```bash
cd prototypes/electron
npm ci
npm start
```

## Making changes

1. Fork the repository and create a branch from `main`.
2. Keep each pull request focused on a single change.
3. Add or update tests in `prototypes/electron/test` for behavior changes.
4. Run `npm run check` (lint, typecheck, tests) and make sure it passes.
5. Open a pull request and fill in the template.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <imperative summary>
```

`type` is one of `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `style`, `build` or `ci`. Keep the summary lowercase with no trailing period, for example `fix: restore pinned tabs after crash`.

## Code style

- ESLint and TypeScript settings in the repository are the source of truth.
- Prefer clear names and small functions over explanatory comments; comment only when the reason is not obvious from the code.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
