# Yalqen

[![CI](https://github.com/YSamed/yalqen/actions/workflows/ci.yml/badge.svg)](https://github.com/YSamed/yalqen/actions/workflows/ci.yml)
[![CodeQL](https://github.com/YSamed/yalqen/actions/workflows/codeql.yml/badge.svg)](https://github.com/YSamed/yalqen/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/YSamed/yalqen?include_prereleases)](https://github.com/YSamed/yalqen/releases)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/YSamed/yalqen/badge)](https://scorecard.dev/viewer/?uri=github.com/YSamed/yalqen)
[![License: MIT](https://img.shields.io/github/license/YSamed/yalqen)](LICENSE)

A fast, privacy-minded web browser for macOS, built with Electron, TypeScript and Svelte.

> **Status:** early prototype. Expect rough edges and breaking changes.

## Features

- Built-in ad and tracker blocking
- HTTPS-only mode and third-party cookie blocking
- Command bar for search, tabs and history
- Pinned tabs that persist across restarts
- Memory saver for inactive tabs
- Native macOS glass window effect where supported

## Install

Download the latest DMG from [Releases](https://github.com/YSamed/yalqen/releases). Requires macOS 13 or later on Apple Silicon.

Releases are not notarized yet, so macOS blocks the first launch. Open **System Settings › Privacy & Security** and click **Open Anyway**. If macOS reports the app as damaged, run:

```bash
xattr -dr com.apple.quarantine /Applications/Yalqen.app
```

## Development

Requires Node.js 24 and macOS.

```bash
cd apps/browser
npm ci
npm start
```

| Command | Purpose |
| --- | --- |
| `npm start` | Build and launch the app |
| `npm run check` | Lint, typecheck and run tests |
| `npm run package:mac` | Build a local DMG/ZIP into `release/` |

See [RELEASING.md](apps/browser/RELEASING.md) for the release process and [CHANGELOG.md](apps/browser/CHANGELOG.md) for release history.

## Built with

[![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)](https://svelte.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)

## Repository layout

| Path | Contents |
| --- | --- |
| `apps/browser` | The browser app (main process, preload, Svelte renderer, tests) |
| `design/brand` | App icons and brand assets |
| `bench` | Page-load benchmark inputs |

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and report security issues as described in [SECURITY.md](SECURITY.md). This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Contributors

<a href="https://github.com/YSamed/yalqen/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=YSamed/yalqen" alt="Contributors" />
</a>

## Star history

<a href="https://star-history.com/#YSamed/yalqen&Date">
  <img src="https://api.star-history.com/svg?repos=YSamed/yalqen&type=Date" alt="Star history chart" />
</a>

## License

Yalqen is released under the [MIT License](LICENSE). Bundled ad-blocking filter lists keep their own licenses; see [THIRD_PARTY_NOTICES.md](apps/browser/THIRD_PARTY_NOTICES.md).

The Yalqen name and logo are not covered by the MIT License and may not be used to endorse or promote derived products without permission.
