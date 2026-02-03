# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.16] - 2026-02-03

### Docs
- Remove real IPs from documentation
- Add security note for trusted MQTT clients
- Add pairing/handshake TODO

## [0.1.15] - 2026-02-03

### Added
- Echo `correlationId` from inbound JSON in outbound replies

### Docs
- Clarify how `senderId` maps to sessions vs `correlationId`

## [0.1.14] - 2026-02-03

### Fixed
- Robust reconnection logic (handles broker down at startup and restarts)
- Clean reconnect scheduling + shutdown cleanup

## [0.1.13] - 2026-02-03

### Fixed
- Rename npm package to `@turquoisebay/mqtt` so install id matches `mqtt`

## [0.1.12] - 2026-02-03

### Fixed
- Set plugin id to `mqtt` to align with channel id and auto-enable/doctor checks

## [0.1.11] - 2026-02-03

### Changed
- Simplified MQTT inbound handling and reduced debug noise
- Publish agent replies to outbound as JSON payloads
- Align plugin id with manifest/config (`openclaw-mqtt`)

## [0.1.10] - 2026-02-03

### Fixed
- Align plugin id with channel id (`mqtt`) to satisfy OpenClaw doctor auto-enable checks

## [0.1.9] - 2026-02-01

### Changed
- Complete rewrite based on Telegram channel architecture analysis
- Use `finalizeInboundContext` for proper inbound message formatting
- Use `dispatchReplyWithBufferedBlockDispatcher` for full agent processing
- Replies are sent back via MQTT outbound topic
- Each MQTT sender gets their own session (mqtt:{senderId})

## [0.1.8] - 2026-02-01

### Fixed
- Use `enqueueSystemEvent` for message injection (simpler, more reliable)
- Removed complex debouncer that required additional params

## [0.1.7] - 2026-02-01

### Fixed
- Use `gateway.startAccount` instead of `gateway.start` (correct OpenClaw plugin API)
- Use `createInboundDebouncer` for proper message injection
- Add `isEnabled` and `isConfigured` config methods
- Return promise that resolves on abort for clean shutdown

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

### TODO
- [ ] TLS certificate file loading
- [ ] Integration tests with Mosquitto container
- [ ] GitHub Actions CI
- [ ] Last Will and Testament support
- [ ] Multiple topic subscriptions
- [ ] Pairing/handshake for trusted clients

## [0.1.0] - Unreleased

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
