# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.6] - 2026-02-01

### Fixed
- Plugin id changed from `mqtt` to `openclaw-mqtt` to match install directory name
- Fixes "plugin not found" error during install

## [0.1.5] - 2026-02-01

### Added
- Onboarding adapter for `openclaw configure channels` support
- Interactive setup prompts for broker URL, auth, topics, QoS, TLS

## [0.1.4] - 2026-02-01

### Fixed
- Package now ships pre-built JS files (consumers no longer need to compile)
- Added `files` field to package.json for clean npm publishing
- Added type declarations for openclaw/plugin-sdk (SDK doesn't ship .d.ts yet)
- Fixed implicit `any` type errors in channel.ts

### Changed
- `main` now points to `dist/index.js` instead of `index.ts`
- `openclaw.extensions` updated to reference compiled output
- Added `prepublishOnly` script to ensure build before publish

## [Unreleased]

### Added
- Initial project scaffold
- Plugin manifest (`openclaw.plugin.json`)
- Config schema with Zod validation
- Channel plugin structure following OpenClaw conventions
- README with installation and usage docs
- TypeScript configuration
- MQTT client manager with connection lifecycle
- Subscribe to inbound topic, inject messages to OpenClaw
- Publish to outbound topic via sendText
- Reconnection with exponential backoff
- MQTT wildcard support (+ and #)
- Environment variable support for secrets
- JSON message parsing for structured alerts
- Unit tests for topic matching and config merge

### TODO
- [ ] TLS certificate file loading
- [ ] Integration tests with Mosquitto container
- [ ] GitHub Actions CI
- [ ] Last Will and Testament support
- [ ] Multiple topic subscriptions

## [0.1.0] - Unreleased

Initial release (in development).
