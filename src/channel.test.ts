import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetMock, getMockClient } from "./__mocks__/mqtt.js";

// Mock the mqtt module
vi.mock("mqtt", () => import("./__mocks__/mqtt.js"));

// Import after mocking
import { mqttPlugin } from "./channel.js";

describe("mqttPlugin", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const mockInjectMessage = vi.fn();

  const defaultCfg = {
    channels: {
      mqtt: {
        brokerUrl: "mqtt://localhost:1883",
        topics: {
          inbound: "openclaw/inbound",
          outbound: "openclaw/outbound",
        },
        qos: 1 as const,
      },
    },
  };

  beforeEach(() => {
    resetMock();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("meta", () => {
    it("should have correct id and label", () => {
      expect(mqttPlugin.id).toBe("mqtt");
      expect(mqttPlugin.meta.label).toBe("MQTT");
      expect(mqttPlugin.meta.aliases).toContain("mosquitto");
    });
  });

  describe("capabilities", () => {
    it("should support direct chat only", () => {
      expect(mqttPlugin.capabilities.chatTypes).toContain("direct");
      expect(mqttPlugin.capabilities.supportsMedia).toBe(false);
      expect(mqttPlugin.capabilities.supportsReactions).toBe(false);
    });
  });

  describe("config", () => {
    it("should list account IDs when configured", () => {
      const ids = mqttPlugin.config.listAccountIds(defaultCfg as any);
      expect(ids).toContain("default");
    });

    it("should return empty when not configured", () => {
      const ids = mqttPlugin.config.listAccountIds({} as any);
      expect(ids).toEqual([]);
    });

    it("should resolve account with broker URL", () => {
      const account = mqttPlugin.config.resolveAccount(defaultCfg as any, "default");
      expect(account.brokerUrl).toBe("mqtt://localhost:1883");
    });
  });

  describe("gateway.start", () => {
    it("should skip if not configured", async () => {
      await mqttPlugin.gateway?.start?.({
        cfg: {} as any,
        logger: mockLogger,
        injectMessage: mockInjectMessage,
      } as any);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "MQTT channel not configured, skipping"
      );
    });

    it("should connect and subscribe when configured", async () => {
      await mqttPlugin.gateway?.start?.({
        cfg: defaultCfg as any,
        logger: mockLogger,
        injectMessage: mockInjectMessage,
      } as any);

      // Wait for async connect
      await new Promise((r) => setTimeout(r, 50));

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("MQTT channel starting")
      );

      const mock = getMockClient();
      expect(mock?.subscriptions.has("openclaw/inbound")).toBe(true);
    });

    it("should inject message on inbound MQTT", async () => {
      await mqttPlugin.gateway?.start?.({
        cfg: defaultCfg as any,
        logger: mockLogger,
        injectMessage: mockInjectMessage,
      } as any);

      await new Promise((r) => setTimeout(r, 50));

      const mock = getMockClient();
      mock?.simulateMessage("openclaw/inbound", "Alert: Service down");

      expect(mockInjectMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "mqtt",
          text: "Alert: Service down",
        })
      );
    });

    it("should parse JSON messages", async () => {
      await mqttPlugin.gateway?.start?.({
        cfg: defaultCfg as any,
        logger: mockLogger,
        injectMessage: mockInjectMessage,
      } as any);

      await new Promise((r) => setTimeout(r, 50));

      const mock = getMockClient();
      mock?.simulateMessage(
        "openclaw/inbound",
        JSON.stringify({
          message: "Server CPU high",
          source: "uptime-kuma",
          severity: "warning",
        })
      );

      expect(mockInjectMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "mqtt",
          text: "Server CPU high",
          senderId: "uptime-kuma",
        })
      );
    });
  });

  describe("gateway.stop", () => {
    it("should disconnect cleanly", async () => {
      await mqttPlugin.gateway?.start?.({
        cfg: defaultCfg as any,
        logger: mockLogger,
        injectMessage: mockInjectMessage,
      } as any);

      await new Promise((r) => setTimeout(r, 50));

      await mqttPlugin.gateway?.stop?.({
        logger: mockLogger,
      } as any);

      expect(mockLogger.info).toHaveBeenCalledWith("MQTT channel stopping");
    });
  });

  describe("outbound.sendText", () => {
    it("should publish to outbound topic", async () => {
      await mqttPlugin.gateway?.start?.({
        cfg: defaultCfg as any,
        logger: mockLogger,
        injectMessage: mockInjectMessage,
      } as any);

      await new Promise((r) => setTimeout(r, 50));

      const result = await mqttPlugin.outbound.sendText({
        text: "Hello from OpenClaw",
        cfg: defaultCfg as any,
      } as any);

      expect(result.ok).toBe(true);

      const mock = getMockClient();
      expect(mock?.published).toContainEqual(
        expect.objectContaining({
          topic: "openclaw/outbound",
          message: "Hello from OpenClaw",
        })
      );
    });

    it("should fail if not configured", async () => {
      const result = await mqttPlugin.outbound.sendText({
        text: "Hello",
        cfg: {} as any,
      } as any);

      expect(result.ok).toBe(false);
      expect(result.error).toBe("MQTT not configured");
    });

    it("should fail if not connected", async () => {
      // Ensure we're disconnected by stopping any previous connection
      await mqttPlugin.gateway?.stop?.({
        logger: mockLogger,
      } as any);

      // Reset mock to ensure clean state
      resetMock();

      const result = await mqttPlugin.outbound.sendText({
        text: "Hello",
        cfg: defaultCfg as any,
      } as any);

      expect(result.ok).toBe(false);
      expect(result.error).toBe("MQTT not connected");
    });
  });
});

describe("inbound message parsing", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const mockInjectMessage = vi.fn();

  const cfg = {
    channels: {
      mqtt: {
        brokerUrl: "mqtt://localhost:1883",
        topics: { inbound: "test/in", outbound: "test/out" },
        qos: 1 as const,
      },
    },
  };

  beforeEach(() => {
    resetMock();
    vi.clearAllMocks();
  });

  it("should handle plain text messages", async () => {
    await mqttPlugin.gateway?.start?.({
      cfg: cfg as any,
      logger: mockLogger,
      injectMessage: mockInjectMessage,
    } as any);

    await new Promise((r) => setTimeout(r, 50));

    getMockClient()?.simulateMessage("test/in", "Plain text alert");

    expect(mockInjectMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Plain text alert",
        senderId: "test-in", // topic with / replaced
      })
    );
  });

  it("should extract message from various JSON formats", async () => {
    await mqttPlugin.gateway?.start?.({
      cfg: cfg as any,
      logger: mockLogger,
      injectMessage: mockInjectMessage,
    } as any);

    await new Promise((r) => setTimeout(r, 50));

    const testCases = [
      { input: { message: "msg1" }, expected: "msg1" },
      { input: { text: "msg2" }, expected: "msg2" },
      { input: { msg: "msg3" }, expected: "msg3" },
      { input: { alert: "msg4" }, expected: "msg4" },
      { input: { body: "msg5" }, expected: "msg5" },
    ];

    for (const { input, expected } of testCases) {
      mockInjectMessage.mockClear();
      getMockClient()?.simulateMessage("test/in", JSON.stringify(input));

      expect(mockInjectMessage).toHaveBeenCalledWith(
        expect.objectContaining({ text: expected })
      );
    }
  });

  it("should extract sender from JSON", async () => {
    await mqttPlugin.gateway?.start?.({
      cfg: cfg as any,
      logger: mockLogger,
      injectMessage: mockInjectMessage,
    } as any);

    await new Promise((r) => setTimeout(r, 50));

    const testCases = [
      { input: { message: "x", source: "src1" }, expectedSender: "src1" },
      { input: { message: "x", sender: "src2" }, expectedSender: "src2" },
      { input: { message: "x", from: "src3" }, expectedSender: "src3" },
      { input: { message: "x", service: "src4" }, expectedSender: "src4" },
    ];

    for (const { input, expectedSender } of testCases) {
      mockInjectMessage.mockClear();
      getMockClient()?.simulateMessage("test/in", JSON.stringify(input));

      expect(mockInjectMessage).toHaveBeenCalledWith(
        expect.objectContaining({ senderId: expectedSender })
      );
    }
  });
});
