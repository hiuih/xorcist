# Xorcist

A native macOS wrapper for [X](https://x.com) built with Electron. Real dock icon, real title bar, working camera/mic, native notifications — the real X in an app that feels like it belongs on your Mac.

**Unofficial, independent project.** Not made by, affiliated with, or endorsed by X Corp. It's a thin native shell around X's own website — every account and post is served by X's real servers.

Note: "Continue with Google" on the login screen will not work — Google blocks all sign-ins from embedded browser frameworks as an anti-phishing measure. Use email/username/phone login instead.

## Install

Download the latest `.dmg` from [Releases](../../releases), open it, and drag Xorcist to Applications. Unsigned build — first launch: right-click → Open.

## Build from source

```bash
npm install
npm run dist
```
