import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetMock, getMockClient } from "./__mocks__/mqtt.js";

// Mock the mqtt module
vi.mock("mqtt", () => import("./__mocks__/mqtt.js"));

// Import after mocking
import { mqttPlugin } from "./channel.js";
import { setMqttRuntime } from "./runtime.js";

describe("mqttPlugin", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const mockDispatchReply = vi.fn(async () => undefined);
  const mockFinalizeInboundContext = vi.fn((payload: any) => payload);

  const mockRuntime = {
    channel: {
      reply: {
        finalizeInboundContext: mockFinalizeInboundContext,
        dispatchReplyWithBufferedBlockDispatcher: mockDispatchReply,
      },
    },
  };

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

  const startAccount = async (cfg: any = defaultCfg, accountId = "default") => {
    const controller = new AbortController();
    const startPromise = mqttPlugin.gateway?.startAccount?.({
      cfg,
      accountId,
      log: mockLogger,
      abortSignal: controller.signal,
    } as any);

    // Wait for async connect
    await new Promise((r) => setTimeout(r, 50));

    return { controller, startPromise };
  };

  beforeEach(() => {
    resetMock();
    vi.clearAllMocks();
    setMqttRuntime(mockRuntime as any);
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

  describe("gateway.startAccount", () => {
    it("should skip if not configured", async () => {
      await mqttPlugin.gateway?.startAccount?.({
        cfg: {} as any,
        accountId: "default",
        log: mockLogger,
        abortSignal: new AbortController().signal,
      } as any);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "MQTT channel not configured, skipping"
      );
    });

    it("should connect and subscribe when configured", async () => {
      const { controller, startPromise } = await startAccount();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("starting MQTT provider")
      );

      const mock = getMockClient();
      expect(mock?.subscriptions.has("openclaw/inbound")).toBe(true);

      controller.abort();
      await startPromise;
    });

    it("should process inbound MQTT messages", async () => {
      const { controller, startPromise } = await startAccount();

      const mock = getMockClient();
      mock?.simulateMessage("openclaw/inbound", "Alert: Service down");

      expect(mockDispatchReply).toHaveBeenCalled();
      const lastCall = mockDispatchReply.mock.calls.at(-1)?.[0];
      expect(lastCall?.ctx?.Body).toBe("Alert: Service down");

      controller.abort();
      await startPromise;
    });

    it("should parse JSON messages", async () => {
      const { controller, startPromise } = await startAccount();

      const mock = getMockClient();
      mock?.simulateMessage(
        "openclaw/inbound",
        JSON.stringify({
          message: "Server CPU high",
          source: "uptime-kuma",
          severity: "warning",
        })
      );

      expect(mockDispatchReply).toHaveBeenCalled();
      const lastCall = mockDispatchReply.mock.calls.at(-1)?.[0];
      expect(lastCall?.ctx?.Body).toBe("Server CPU high");
      expect(lastCall?.ctx?.SenderId).toBe("uptime-kuma");

      controller.abort();
      await startPromise;
    });
  });

  describe("gateway.abort", () => {
    it("should disconnect cleanly", async () => {
      const { controller, startPromise } = await startAccount();

      controller.abort();
      await startPromise;

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("MQTT channel stopping")
      );
    });
  });

  describe("outbound.sendText", () => {
    it("should publish to outbound topic", async () => {
      const { controller, startPromise } = await startAccount();

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

      controller.abort();
      await startPromise;
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

  const mockDispatchReply = vi.fn(async () => undefined);
  const mockFinalizeInboundContext = vi.fn((payload: any) => payload);

  const mockRuntime = {
    channel: {
      reply: {
        finalizeInboundContext: mockFinalizeInboundContext,
        dispatchReplyWithBufferedBlockDispatcher: mockDispatchReply,
      },
    },
  };

  const cfg = {
    channels: {
      mqtt: {
        brokerUrl: "mqtt://localhost:1883",
        topics: { inbound: "test/in", outbound: "test/out" },
        qos: 1 as const,
      },
    },
  };

  const startAccount = async () => {
    const controller = new AbortController();
    const startPromise = mqttPlugin.gateway?.startAccount?.({
      cfg: cfg as any,
      accountId: "default",
      log: mockLogger,
      abortSignal: controller.signal,
    } as any);

    await new Promise((r) => setTimeout(r, 50));

    return { controller, startPromise };
  };

  beforeEach(() => {
    resetMock();
    vi.clearAllMocks();
    setMqttRuntime(mockRuntime as any);
  });

  it("should handle plain text messages", async () => {
    const { controller, startPromise } = await startAccount();

    getMockClient()?.simulateMessage("test/in", "Plain text alert");

    expect(mockDispatchReply).toHaveBeenCalled();
    const lastCall = mockDispatchReply.mock.calls.at(-1)?.[0];
    expect(lastCall?.ctx?.Body).toBe("Plain text alert");
    expect(lastCall?.ctx?.SenderId).toBe("test-in");

    controller.abort();
    await startPromise;
  });

  it("should extract message from various JSON formats", async () => {
    const { controller, startPromise } = await startAccount();

    const testCases = [
      { input: { message: "msg1" }, expected: "msg1" },
      { input: { text: "msg2" }, expected: "msg2" },
      { input: { msg: "msg3" }, expected: "msg3" },
      { input: { alert: "msg4" }, expected: "msg4" },
      { input: { body: "msg5" }, expected: "msg5" },
    ];

    for (const { input, expected } of testCases) {
      mockDispatchReply.mockClear();
      getMockClient()?.simulateMessage("test/in", JSON.stringify(input));

      const lastCall = mockDispatchReply.mock.calls.at(-1)?.[0];
      expect(lastCall?.ctx?.Body).toBe(expected);
    }

    controller.abort();
    await startPromise;
  });

  it("should extract sender from JSON", async () => {
    const { controller, startPromise } = await startAccount();

    const testCases = [
      { input: { message: "x", source: "src1" }, expectedSender: "src1" },
      { input: { message: "x", sender: "src2" }, expectedSender: "src2" },
      { input: { message: "x", from: "src3" }, expectedSender: "src3" },
      { input: { message: "x", service: "src4" }, expectedSender: "src4" },
    ];

    for (const { input, expectedSender } of testCases) {
      mockDispatchReply.mockClear();
      getMockClient()?.simulateMessage("test/in", JSON.stringify(input));

      const lastCall = mockDispatchReply.mock.calls.at(-1)?.[0];
      expect(lastCall?.ctx?.SenderId).toBe(expectedSender);
    }

    controller.abort();
    await startPromise;
  });
});
