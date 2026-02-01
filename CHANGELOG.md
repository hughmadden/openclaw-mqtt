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

### TODO
- [ ] Implement MQTT client connection
- [ ] Subscribe to inbound topic
- [ ] Publish to outbound topic
- [ ] Reconnection with exponential backoff
- [ ] TLS support
- [ ] Unit tests
- [ ] Integration tests with Mosquitto container
- [ ] GitHub Actions CI

## [0.1.0] - Unreleased

Initial release (in development).
