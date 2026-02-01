import { describe, it, expect } from "vitest";

// Note: Full integration tests require a running MQTT broker.
// These are unit tests for the helper functions.

describe("topicMatches", () => {
  // Import the function once it's exported
  // For now, inline the logic for testing
  
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
  it("should merge config with env vars", async () => {
    // Set env vars
    const originalEnv = process.env.MQTT_PASSWORD;
    process.env.MQTT_PASSWORD = "env-secret";

    const { mergeWithEnv } = await import("./env.js");
    
    const config = mergeWithEnv({
      brokerUrl: "mqtt://localhost:1883",
      password: "config-secret",
    });

    expect(config.password).toBe("env-secret"); // env takes precedence
    expect(config.brokerUrl).toBe("mqtt://localhost:1883");

    // Restore
    if (originalEnv) {
      process.env.MQTT_PASSWORD = originalEnv;
    } else {
      delete process.env.MQTT_PASSWORD;
    }
  });
});
