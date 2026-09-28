<div align="center">
  <img src="design/brand/png/icon-256.png" alt="Yalqen" width="112">

  <h1>Yalqen</h1>

  <p>A fast, privacy-minded web browser for macOS.</p>

  <p>
    <a href="https://github.com/YSamed/yalqen/releases/latest"><img src="design/readme/download-button.png" alt="Download for macOS" width="260"></a>
  </p>

  <p>
    <a href="https://yalqen.com/">Website</a> ·
    <a href="apps/browser/CHANGELOG.md">Changelog</a> ·
    <a href="CONTRIBUTING.md">Contribute</a> ·
    <a href="https://github.com/YSamed/yalqen/issues">Report a bug</a>
  </p>
</div>

<p align="center">
  <a href="https://yalqen.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="design/screenshots/website-dark.png">
      <source media="(prefers-color-scheme: light)" srcset="design/screenshots/website-light.png">
      <img src="design/screenshots/website-light.png" alt="Yalqen website: Light as paper. Clear as glass." width="900">
    </picture>
  </a>
</p>

<p align="center">
  <img src="design/readme/feature-ad-blocking.png" alt="Ad & tracker blocking" width="240">
  <img src="design/readme/feature-cookies.png" alt="Third-party cookie blocking" width="281">
  <img src="design/readme/feature-https-only.png" alt="HTTPS-only mode" width="215">
  <img src="design/readme/feature-secure-dns.png" alt="Secure DNS" width="174">
  <img src="design/readme/feature-command-bar.png" alt="Command bar" width="188">
  <img src="design/readme/feature-pinned-tabs.png" alt="Pinned tabs" width="173">
  <img src="design/readme/feature-memory-saver.png" alt="Memory saver" width="189">
  <img src="design/readme/feature-search-engines.png" alt="5 search engines" width="209">
  <img src="design/readme/feature-developer-tools.png" alt="Developer tools" width="200">
</p>

## Install

Requires macOS 13+ on Apple Silicon. Builds are not notarized yet; if macOS reports the app as damaged, run:

```bash
xattr -dr com.apple.quarantine /Applications/Yalqen.app
```

## Development

```bash
cd apps/browser
npm ci
npm start
```

## License

[MIT](LICENSE). Filter lists keep their own licenses, see [THIRD_PARTY_NOTICES.md](apps/browser/THIRD_PARTY_NOTICES.md). The Yalqen name and logo are not covered by the MIT License.
