/**
 * 配置模块测试
 */
import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const validEnv = {
    HUB_URL: "https://hub.example.com",
    BASE_URL: "https://app.example.com",
  };

  it("使用默认端口 8097", () => {
    const config = loadConfig(validEnv);
    expect(config.port).toBe("8097");
  });

  it("可以通过 PORT 覆盖默认端口", () => {
    const config = loadConfig({ ...validEnv, PORT: "3000" });
    expect(config.port).toBe("3000");
  });

  it("使用默认数据库路径 data/rss.db", () => {
    const config = loadConfig(validEnv);
    expect(config.dbPath).toBe("data/rss.db");
  });

  it("可以通过 DB_PATH 覆盖数据库路径", () => {
    const config = loadConfig({ ...validEnv, DB_PATH: "/tmp/test.db" });
    expect(config.dbPath).toBe("/tmp/test.db");
  });

  it("缺少 HUB_URL 时抛出异常", () => {
    expect(() => loadConfig({ BASE_URL: "https://app.example.com" })).toThrow("HUB_URL");
  });

  it("缺少 BASE_URL 时抛出异常", () => {
    expect(() => loadConfig({ HUB_URL: "https://hub.example.com" })).toThrow("BASE_URL");
  });

  it("正确加载所有配置项", () => {
    const config = loadConfig({
      PORT: "9090",
      HUB_URL: "https://hub.example.com",
      BASE_URL: "https://app.example.com",
      DB_PATH: "/data/my.db",
    });

    expect(config).toEqual({
      port: "9090",
      hubUrl: "https://hub.example.com",
      baseUrl: "https://app.example.com",
      dbPath: "/data/my.db",
    });
  });
});
