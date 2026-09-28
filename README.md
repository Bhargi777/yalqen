<div align="center">
  <img src="design/brand/png/icon-256.png" alt="Yalqen" width="128">

  <h1>Yalqen</h1>

  <p><strong>A fast, privacy-minded web browser for macOS.</strong><br>Open source. Early prototype.</p>

  <p>
    <a href="https://github.com/YSamed/yalqen/releases/latest"><img src="design/readme/download-button.png" alt="Download for macOS" width="260"></a>
  </p>

  <p>
    <a href="https://yalqen.com/"><img src="design/readme/website.png" alt="Website" width="163"></a>
    <a href="apps/browser/CHANGELOG.md"><img src="design/readme/changelog.png" alt="Changelog" width="183"></a>
    <a href="CONTRIBUTING.md"><img src="design/readme/contribute.png" alt="Contribute" width="181"></a>
    <a href="https://github.com/YSamed/yalqen/issues"><img src="design/readme/report-bug.png" alt="Report a bug" width="198"></a>
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

## Features

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

## Privacy

<p align="center">
  <img src="design/readme/privacy-no-telemetry.png" alt="No telemetry" width="182">
  <img src="design/readme/privacy-no-accounts.png" alt="No accounts" width="178">
  <img src="design/readme/privacy-local-data.png" alt="Data stays on your Mac" width="253">
</p>

Everything lives in `~/Library/Application Support/yalqen-electron-prototype/`.

## Install

<p align="center">
  <img src="design/readme/req-macos.png" alt="macOS 13+" width="168">
  <img src="design/readme/req-apple-silicon.png" alt="Apple Silicon" width="181">
</p>

Open the DMG and drag Yalqen into Applications. Builds are not notarized yet; if macOS reports the app as damaged, run:

```bash
xattr -dr com.apple.quarantine /Applications/Yalqen.app
```

## Build From Source

```bash
git clone https://github.com/YSamed/yalqen.git
cd yalqen/apps/browser
npm ci
npm start
```

## License

<p align="center">
  <a href="LICENSE"><img src="design/readme/license-mit.png" alt="MIT License" width="172"></a>
</p>

Filter lists keep their own licenses, see [THIRD_PARTY_NOTICES.md](apps/browser/THIRD_PARTY_NOTICES.md). The Yalqen name and logo are not covered by the MIT License.
