/**
 * FeedChecker 定时检查器测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FeedChecker } from "../src/feed-checker.js";
import { Store } from "../src/store.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** 保存原始 fetch */
const originalFetch = globalThis.fetch;

describe("FeedChecker", () => {
  let store: Store;
  let checker: FeedChecker;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rss-checker-test-"));
    store = new Store(path.join(tmpDir, "test.db"));
    checker = new FeedChecker(store);

    // 添加安装记录（推送通知需要）
    store.saveInstallation({
      id: "inst-001",
      hubUrl: "https://hub.example.com",
      appId: "app-001",
      botId: "bot-001",
      appToken: "token-001",
      webhookSecret: "secret-001",
    });
  });

  afterEach(() => {
    checker.stop();
    globalThis.fetch = originalFetch;
    store.close();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("无订阅时 checkAll 返回 0", async () => {
    const count = await checker.checkAll();
    expect(count).toBe(0);
  });

  it("checkUserFeeds 无订阅时返回提示", async () => {
    const result = await checker.checkUserFeeds("inst-001", "user-001");
    expect(result).toContain("暂无订阅");
  });

  it("start 和 stop 正常工作", () => {
    // mock parseFeed 以防实际网络请求
    vi.spyOn(checker, "checkAll").mockResolvedValue(0);
    checker.start();
    // 应该不抛异常
    checker.stop();
  });
});
