# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
