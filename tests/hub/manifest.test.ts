/**
 * 应用清单测试
 */
import { describe, it, expect } from "vitest";
import { manifest } from "../../src/hub/manifest.js";

describe("manifest", () => {
  it("slug 为 rss", () => {
    expect(manifest.slug).toBe("rss");
  });

  it("包含应用名称", () => {
    expect(manifest.name).toBe("RSS 订阅推送");
  });

  it("图标为 📰", () => {
    expect(manifest.icon).toBe("📰");
  });

  it("包含应用描述", () => {
    expect(manifest.description).toBeTruthy();
    expect(manifest.description).toContain("RSS");
  });

  it("订阅了 command 事件", () => {
    expect(manifest.events).toContain("command");
  });

  it("config_schema 为空对象", () => {
    expect(manifest.config_schema).toEqual({});
  });

  it("guide 未定义", () => {
    expect(manifest.guide).toBeUndefined();
  });
});
