<div align="center">
  <h1>Yalqen</h1>
  <p><strong>A fast, privacy-minded web browser for macOS.</strong><br />Early prototype.</p>
  <p>
    <a href="https://github.com/YSamed/yalqen/releases/latest">Download</a> ·
    <a href="https://yalqen.com/">Website</a> ·
    <a href="apps/browser/CHANGELOG.md">Changelog</a> ·
    <a href="CONTRIBUTING.md">Contribute</a> ·
    <a href="https://github.com/YSamed/yalqen/issues">Report a bug</a>
  </p>
  <a href="https://yalqen.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="design/screenshots/website-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="design/screenshots/website-light.png" />
      <img src="design/screenshots/website-light.png" alt="Yalqen website: Light as paper. Clear as glass." width="100%" />
    </picture>
  </a>
  <p>
    <a href="https://github.com/YSamed/yalqen/releases/latest">
      <img src="https://img.shields.io/badge/Download%20for%20macOS-0A84FF?style=for-the-badge&logo=apple&logoColor=white" alt="Download for macOS" />
    </a>
  </p>
</div>

## Features

- Ad, tracker and third-party cookie blocking
- HTTPS-only mode
- Command bar and pinned tabs
- Memory saver for inactive tabs
- Developer tools: emulation, storage inspector, request rules

## Install

Download the DMG from [Releases](https://github.com/YSamed/yalqen/releases) (macOS 13+, Apple Silicon). Builds are not notarized yet; if macOS reports the app as damaged, run:

```bash
xattr -dr com.apple.quarantine /Applications/Yalqen.app
```

## Development

```bash
cd apps/browser
npm ci
npm start
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Filter lists keep their own licenses, see [THIRD_PARTY_NOTICES.md](apps/browser/THIRD_PARTY_NOTICES.md). The Yalqen name and logo are not covered by the MIT License.
