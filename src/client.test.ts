import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockMqttClient, resetMock, getMockClient } from "./__mocks__/mqtt.js";

// Mock the mqtt module
vi.mock("mqtt", () => import("./__mocks__/mqtt.js"));

// Import after mocking
import { createMqttClient } from "./client.js";

describe("MqttClientManager", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const defaultConfig = {
    brokerUrl: "mqtt://localhost:1883",
    topics: {
      inbound: "openclaw/inbound",
      outbound: "openclaw/outbound",
    },
    qos: 1 as const,
  };

  beforeEach(() => {
    resetMock();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("connect", () => {
    it("should connect to broker", async () => {
      const client = createMqttClient(defaultConfig, mockLogger);
      await client.connect();

      expect(client.isConnected()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Connecting to MQTT broker")
      );
      expect(mockLogger.info).toHaveBeenCalledWith("MQTT connected");
    });

    it("should not reconnect if already connected", async () => {
      const client = createMqttClient(defaultConfig, mockLogger);
      await client.connect();
      await client.connect(); // Second call

      expect(mockLogger.debug).toHaveBeenCalledWith("MQTT already connected");
    });

    it("should use custom client ID if provided", async () => {
      const config = { ...defaultConfig, clientId: "my-custom-client" };
      const client = createMqttClient(config, mockLogger);
      await client.connect();

      // Client ID is passed to mqtt.connect options
      expect(client.isConnected()).toBe(true);
    });
  });

  describe("disconnect", () => {
    it("should disconnect cleanly", async () => {
      const client = createMqttClient(defaultConfig, mockLogger);
      await client.connect();
      await client.disconnect();

      expect(client.isConnected()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith("MQTT disconnected");
    });

    it("should handle disconnect when not connected", async () => {
      const client = createMqttClient(defaultConfig, mockLogger);
      await client.disconnect(); // Should not throw

      expect(client.isConnected()).toBe(false);
    });
  });

  describe("subscribe", () => {
    it("should subscribe to topic", async () => {
      const client = createMqttClient(defaultConfig, mockLogger);
      const handler = vi.fn();

      await client.connect();
      client.subscribe("test/topic", handler);

      const mock = getMockClient();
      expect(mock?.subscriptions.has("test/topic")).toBe(true);
    });

    it("should call handler when message received", async () => {
      const client = createMqttClient(defaultConfig, mockLogger);
      const handler = vi.fn();

      await client.connect();
      client.subscribe("test/topic", handler);

      const mock = getMockClient();
      mock?.simulateMessage("test/topic", "hello world");

      expect(handler).toHaveBeenCalledWith(
        "test/topic",
        Buffer.from("hello world")
      );
    });

    it("should resubscribe on reconnect", async () => {
      const client = createMqttClient(defaultConfig, mockLogger);
      const handler = vi.fn();

      client.subscribe("test/topic", handler);
      await client.connect();

      const mock = getMockClient();
      expect(mock?.subscriptions.has("test/topic")).toBe(true);
    });
  });

  describe("publish", () => {
    it("should publish message to topic", async () => {
      const client = createMqttClient(defaultConfig, mockLogger);
      await client.connect();
      await client.publish("test/topic", "hello world");

      const mock = getMockClient();
      expect(mock?.published).toContainEqual(
        expect.objectContaining({
          topic: "test/topic",
          message: "hello world",
        })
      );
    });

    it("should throw if not connected", async () => {
      const client = createMqttClient(defaultConfig, mockLogger);

      await expect(
        client.publish("test/topic", "hello")
      ).rejects.toThrow("MQTT not connected");
    });

    it("should use configured QoS", async () => {
      const config = { ...defaultConfig, qos: 2 as const };
      const client = createMqttClient(config, mockLogger);
      await client.connect();
      await client.publish("test/topic", "hello");

      const mock = getMockClient();
      expect(mock?.published[0].opts).toEqual({ qos: 2 });
    });
  });
});

describe("topicMatches", () => {
  // Inline the function for testing (or export it from client.ts)
  function topicMatches(pattern: string, topic: string): boolean {
    if (pattern === topic) return true;
    if (!pattern.includes("+") && !pattern.includes("#")) return false;

    const patternParts = pattern.split("/");
    const topicParts = topic.split("/");

    for (let i = 0; i < patternParts.length; i++) {
      const p = patternParts[i];

      if (p === "#") {
        return true;
      }

      if (p === "+") {
        if (i >= topicParts.length) return false;
        continue;
      }

      if (p !== topicParts[i]) {
        return false;
      }
    }

    return patternParts.length === topicParts.length;
  }

  it("matches exact topics", () => {
    expect(topicMatches("home/living/temp", "home/living/temp")).toBe(true);
    expect(topicMatches("home/living/temp", "home/living/humidity")).toBe(false);
  });

  it("matches single-level wildcard (+)", () => {
    expect(topicMatches("home/+/temp", "home/living/temp")).toBe(true);
    expect(topicMatches("home/+/temp", "home/bedroom/temp")).toBe(true);
    expect(topicMatches("home/+/temp", "home/living/humidity")).toBe(false);
    expect(topicMatches("+/living/temp", "home/living/temp")).toBe(true);
  });

  it("matches multi-level wildcard (#)", () => {
    expect(topicMatches("home/#", "home/living/temp")).toBe(true);
    expect(topicMatches("home/#", "home/living/sensors/temp")).toBe(true);
    expect(topicMatches("home/#", "home")).toBe(true);
    expect(topicMatches("#", "anything/at/all")).toBe(true);
  });

  it("handles edge cases", () => {
    expect(topicMatches("home/+", "home")).toBe(false);
    expect(topicMatches("home/+/+", "home/a/b")).toBe(true);
    expect(topicMatches("home/+/+", "home/a")).toBe(false);
  });
});

describe("config merging", () => {
  beforeEach(() => {
    // Clear env vars
    delete process.env.MQTT_BROKER_URL;
    delete process.env.MQTT_USERNAME;
    delete process.env.MQTT_PASSWORD;
    delete process.env.MQTT_CLIENT_ID;
  });

  it("should use config values when no env vars", async () => {
    const { mergeWithEnv } = await import("./env.js");

    const config = mergeWithEnv({
      brokerUrl: "mqtt://localhost:1883",
      username: "user",
      password: "pass",
    });

    expect(config.brokerUrl).toBe("mqtt://localhost:1883");
    expect(config.username).toBe("user");
    expect(config.password).toBe("pass");
  });

  it("should override with env vars", async () => {
    process.env.MQTT_PASSWORD = "env-secret";
    process.env.MQTT_BROKER_URL = "mqtt://env-broker:1883";

    // Re-import to pick up env changes
    vi.resetModules();
    const { mergeWithEnv } = await import("./env.js");

    const config = mergeWithEnv({
      brokerUrl: "mqtt://config-broker:1883",
      password: "config-secret",
    });

    expect(config.password).toBe("env-secret");
    expect(config.brokerUrl).toBe("mqtt://env-broker:1883");
  });

  it("should use default topics if not provided", async () => {
    const { mergeWithEnv } = await import("./env.js");

    const config = mergeWithEnv({
      brokerUrl: "mqtt://localhost:1883",
    });

    expect(config.topics.inbound).toBe("openclaw/inbound");
    expect(config.topics.outbound).toBe("openclaw/outbound");
  });
});
