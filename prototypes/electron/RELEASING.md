# Releasing

Yalqen is distributed directly as a DMG/ZIP (Developer ID), not through the Mac App Store.

Pushing a `v*` tag runs `.github/workflows/release.yml`, which checks, builds and packages the macOS app and uploads the DMG and ZIP as a workflow artifact. The tag sets the version (`v1.2.0` builds `1.2.0`).

```bash
git tag v0.1.0 && git push origin v0.1.0
```

## Signing and notarization

Apps downloaded outside the App Store still need a Developer ID signature and Apple notarization, otherwise Gatekeeper refuses to open them on other Macs. Both require a paid Apple Developer Program membership; nothing is submitted to the App Store.

Signing certificate:

| Secret | Value |
| --- | --- |
| `MAC_CERTIFICATE_P12_BASE64` | "Developer ID Application" certificate exported as `.p12`, base64-encoded |
| `MAC_CERTIFICATE_PASSWORD` | Password of that `.p12` |

Notarization, with either an Apple ID:

| Secret | Value |
| --- | --- |
| `APPLE_ID` | Apple ID email of the developer account |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password created at appleid.apple.com |
| `APPLE_TEAM_ID` | Team ID shown in the developer account |

or with an API key (created under App Store Connect > Users and Access > Integrations; only used for notarization):

| Secret | Value |
| --- | --- |
| `APPLE_API_KEY_P8` | Contents of `AuthKey_XXXX.p8` |
| `APPLE_API_KEY_ID` | Key ID |
| `APPLE_API_ISSUER` | Issuer ID |

Without these secrets the build still succeeds but is only ad-hoc signed: users on other Macs have to allow it under System Settings > Privacy & Security before it opens.

Signing uses hardened runtime with `build/entitlements.mac.plist` (JIT, camera, microphone, location).

## Local package

```bash
npm run package:mac
```

This signs with a Developer ID certificate from the login keychain when one exists, otherwise it produces an ad-hoc signed build for local use.

## Hardening

The packaged binary has these Electron fuses flipped: `runAsNode`, `NODE_OPTIONS` and `--inspect` are disabled, and the app only loads from an integrity-checked `app.asar`. Code that needs a separate Node process must use a utility process.
