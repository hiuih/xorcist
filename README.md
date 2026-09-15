# Xorcist

A native macOS wrapper for [X](https://x.com) built with Electron. Real dock icon, real title bar, working camera/mic, native notifications — the real X in an app that feels like it belongs on your Mac.

**Unofficial, independent project.** Not made by, affiliated with, or endorsed by X Corp. It's a thin native shell around X's own website — every account and post is served by X's real servers.

Note: "Continue with Google" works for password sign-in, but passkey/Touch ID sign-in inside that popup does not — Electron doesn't have built-in support for macOS's Touch ID as a WebAuthn platform authenticator. Use the "Enter your password" option in the Google popup if passkey doesn't respond.

## Install

Download the latest `.dmg` from [Releases](../../releases), open it, and drag Xorcist to Applications. Unsigned build — first launch: right-click → Open.

## Build from source

```bash
npm install
npm run dist
```
