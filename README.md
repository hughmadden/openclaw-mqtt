# @turquoisebay/openclaw-mqtt

[![CI](https://github.com/hughmadden/openclaw-mqtt/actions/workflows/ci.yml/badge.svg)](https://github.com/hughmadden/openclaw-mqtt/actions)
[![npm](https://img.shields.io/npm/v/@turquoisebay/openclaw-mqtt)](https://www.npmjs.com/package/@turquoisebay/openclaw-mqtt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MQTT channel plugin for [OpenClaw](https://github.com/openclaw/openclaw) — bidirectional messaging via MQTT brokers.

## Features

- 🔌 **Bidirectional messaging** — subscribe and publish to MQTT topics
- 🏠 **Home automation ready** — integrates with Home Assistant, Mosquitto, EMQX
- 🔒 **TLS support** — secure connections to cloud brokers
- 📊 **Service monitoring** — receive alerts from Uptime Kuma, healthchecks, etc.
- ⚡ **QoS levels** — configurable delivery guarantees (0, 1, 2)

## Installation

```bash
openclaw plugins install @turquoisebay/openclaw-mqtt
```

Or manually:

```bash
git clone https://github.com/hughmadden/openclaw-mqtt ~/.openclaw/extensions/mqtt
cd ~/.openclaw/extensions/mqtt && npm install
```

## Configuration

Add to `~/.openclaw/openclaw.json`:

```json5
{
  channels: {
    mqtt: {
      brokerUrl: "mqtt://localhost:1883",
      // Optional auth
      username: "openclaw",
      password: "secret",
      // Topics
      topics: {
        inbound: "openclaw/inbound",   // Subscribe to this
        outbound: "openclaw/outbound"  // Publish responses here
      },
      // Quality of Service (0=fire-and-forget, 1=at-least-once, 2=exactly-once)
      qos: 1
    }
  }
}
```

Then restart the gateway:

```bash
openclaw gateway restart
```

## Usage

### Receiving messages (inbound)

Messages published to your `inbound` topic will be processed by OpenClaw:

```bash
# External service sends alert
mosquitto_pub -t "openclaw/inbound" -m "Alert: Service down on playground"
```

### Sending messages (outbound)

OpenClaw can publish to the `outbound` topic via the `message` tool:

```bash
openclaw agent --message "Send MQTT: Temperature is 23°C"
```

## Use Cases

### Service Monitoring

Pair with [Uptime Kuma](https://github.com/louislam/uptime-kuma) to receive alerts:

1. Configure Uptime Kuma notification → MQTT
2. Set topic to `openclaw/inbound`
3. OpenClaw receives and can act on alerts

### Home Assistant Integration

```yaml
# Home Assistant configuration.yaml
mqtt:
  sensor:
    - name: "OpenClaw Status"
      state_topic: "openclaw/outbound"
  
automation:
  - trigger:
      platform: mqtt
      topic: "home/alerts"
    action:
      service: mqtt.publish
      data:
        topic: "openclaw/inbound"
        payload: "{{ trigger.payload }}"
```

## Development

```bash
# Clone
git clone turq@10.0.20.9:/opt/git/openclaw-mqtt.git
cd openclaw-mqtt

# Install deps
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Build
npm run build
```

## Architecture

```
MQTT Broker (Mosquitto/EMQX)
     │
     ├─► inbound topic ──► OpenClaw Gateway ──► Agent
     │
     └─◄ outbound topic ◄── OpenClaw Gateway ◄── Agent
```

## License

MIT © Hugh Madden

## See Also

- [OpenClaw](https://github.com/openclaw/openclaw) — The AI assistant platform
- [MQTT.js](https://github.com/mqttjs/MQTT.js) — MQTT client library
- [Mosquitto](https://mosquitto.org/) — Popular MQTT broker
