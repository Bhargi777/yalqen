# Releasing

Yalqen is distributed as a DMG/ZIP on GitHub Releases, not through the Mac App Store.

Releases are automated with [release-please](https://github.com/googleapis/release-please):

1. Every push to `main` updates an open "chore(main): release x.y.z" pull request. It bumps the version in `package.json` and adds the Conventional Commits since the last release to `CHANGELOG.md`. Every release bumps the patch version (`0.2.0` → `0.2.1` → `0.2.2`), whatever the commit types are. To release a minor or major version instead, add a `Release-As: x.y.z` footer to a commit on `main` (for example `Release-As: 0.3.0`).
2. Merging that pull request tags `vx.y.z` and creates the GitHub release with the changelog.
3. `.github/workflows/release.yml` then checks, builds and packages the macOS app, uploads the DMG and ZIP to the release and appends the install notes from `build/release-notes.md`.

The release pull request is opened by GitHub Actions, so CI does not run on it; merge it with the admin bypass. Pushing a `v*` tag by hand still runs the release workflow on its own.

## Without an Apple developer account (default)

No secrets are needed. The app is ad-hoc signed, so on another Mac the first launch is blocked until the user clicks **Open Anyway** under System Settings › Privacy & Security; the release notes explain this. Camera and microphone permissions may be asked again after each update, because an ad-hoc signature changes with every build.

## Signing and notarization (optional)

With a paid Apple Developer Program membership the app can be signed with a Developer ID and notarized, so it opens on any Mac without the Gatekeeper step. Nothing is submitted to the App Store.

Signing certificate:

| Secret                       | Value                                                                     |
| ---------------------------- | ------------------------------------------------------------------------- |
| `MAC_CERTIFICATE_P12_BASE64` | "Developer ID Application" certificate exported as `.p12`, base64-encoded |
| `MAC_CERTIFICATE_PASSWORD`   | Password of that `.p12`                                                   |

Notarization, with either an Apple ID:

| Secret                        | Value                                              |
| ----------------------------- | -------------------------------------------------- |
| `APPLE_ID`                    | Apple ID email of the developer account            |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password created at appleid.apple.com |
| `APPLE_TEAM_ID`               | Team ID shown in the developer account             |

or with an API key (created under App Store Connect > Users and Access > Integrations; only used for notarization):

| Secret             | Value                         |
| ------------------ | ----------------------------- |
| `APPLE_API_KEY_P8` | Contents of `AuthKey_XXXX.p8` |
| `APPLE_API_KEY_ID` | Key ID                        |
| `APPLE_API_ISSUER` | Issuer ID                     |

Developer ID signing uses hardened runtime with `build/entitlements.mac.plist` (JIT, camera, microphone, location).

## Local package

```bash
npm run package:mac
```

This signs with a Developer ID certificate from the login keychain when one exists, otherwise it produces an ad-hoc signed build for local use.

## Hardening

The packaged binary has these Electron fuses flipped: `runAsNode`, `NODE_OPTIONS` and `--inspect` are disabled, and the app only loads from an integrity-checked `app.asar`. Code that needs a separate Node process must use a utility process.
