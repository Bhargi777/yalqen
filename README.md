<div align="center">
  <img src="design/brand/png/icon-256.png" alt="Yalqen" width="128">

  <h1>Yalqen</h1>

  <p><strong>A fast, privacy-minded web browser for macOS.</strong></p>

  <p>
    Yalqen is a lightweight browser that blocks ads and trackers out of the box, keeps your data on your Mac,
    and stays out of the way. It's open source, has no telemetry, and is still an early prototype.
  </p>

  <p>
    <a href="https://github.com/YSamed/yalqen/releases/latest">
      <img src="https://img.shields.io/badge/Download%20for%20macOS-0A84FF?style=for-the-badge&logo=apple&logoColor=white" alt="Download Yalqen for macOS" height="44">
    </a>
  </p>
</div>

## Light as Paper. Clear as Glass.

A quiet interface with a command bar, pinned tabs and a translucent window that picks up your desktop wallpaper.

<p align="center">
  <a href="https://yalqen.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="design/screenshots/website-dark.png">
      <source media="(prefers-color-scheme: light)" srcset="design/screenshots/website-light.png">
      <img src="design/screenshots/website-light.png" alt="Yalqen website: Light as paper. Clear as glass." width="900">
    </picture>
  </a>
</p>

## What Yalqen Does

| Feature | How it works | Why it's useful |
| --- | --- | --- |
| Ad and tracker blocking | Network and cosmetic filtering built in, with filter lists cached locally and refreshed in the background. | Pages load faster and follow you around less, with no extension to install. |
| Third-party cookie blocking | Turn it on in Settings to drop cross-site cookies. | Advertisers can't stitch your browsing together across sites. |
| HTTPS-only mode | Optionally upgrade every connection to HTTPS, with a warning before falling back to HTTP. | You don't end up on an unencrypted page by accident. |
| Secure DNS | Resolve names over DNS-over-HTTPS through Cloudflare, Google or Quad9. | Your network can't read or tamper with the sites you look up. |
| Command bar | One field for URLs, search, open tabs, bookmarks, history and browser commands. | Everything is a few keystrokes away. |
| Pinned tabs | Keep the sites you always have open fixed at the start of the tab strip. | Mail, chat and docs stay put while the rest comes and goes. |
| Memory saver | Inactive tabs are discarded after a configurable delay, sooner under memory pressure. Pinned, playing and edited tabs are kept. | Dozens of open tabs without the fan spinning up. |
| Search engine choice | Google, Bing, Brave Search, Ecosia or Yandex. | Pick the engine you trust. |
| Developer tools | Device and network emulation, a storage inspector, and request rules to block, mock, redirect or rewrite headers. | Debug and test sites without leaving the browser. |

## Privacy

Yalqen has no accounts, no sync and no telemetry. History, bookmarks, settings and site data live on your Mac at:

```text
~/Library/Application Support/yalqen-electron-prototype/
```

Clear a single site's cookies and storage from the site info menu, or wipe browsing data for the last hour, day, week, month or all time from Settings.

## Install

### Download

Download the latest `Yalqen.dmg` from GitHub Releases:

<p>
  <a href="https://github.com/YSamed/yalqen/releases/latest">
    <img src="https://img.shields.io/badge/Download%20for%20macOS-0A84FF?style=for-the-badge&logo=apple&logoColor=white" alt="Download Yalqen for macOS" height="44">
  </a>
</p>

Open the DMG and drag Yalqen into Applications. Builds are not notarized yet; if macOS reports the app as damaged, run:

```bash
xattr -dr com.apple.quarantine /Applications/Yalqen.app
```

## Requirements

- macOS 13+
- Apple Silicon

## Build From Source

```bash
git clone https://github.com/YSamed/yalqen.git
cd yalqen/apps/browser
npm ci
npm start
```

## Contributing

Issues and pull requests are welcome. If you are planning a larger change, open an issue first so the scope is clear. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

Yalqen is licensed under the [MIT License](LICENSE). Filter lists keep their own licenses, see [THIRD_PARTY_NOTICES.md](apps/browser/THIRD_PARTY_NOTICES.md). The Yalqen name and logo are not covered by the MIT License.

<p align="center">
  <a href="https://yalqen.com/">yalqen.com</a> ·
  <a href="apps/browser/CHANGELOG.md">Changelog</a> ·
  <a href="https://github.com/YSamed/yalqen/issues">Report a bug</a>
</p>
