/**
 * RSS 工具测试 — subscribe_feed / list_feeds / unsubscribe_feed / check_feeds
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rssTools } from "../../src/tools/rss.js";
import { Store } from "../../src/store.js";
import type { ToolContext } from "../../src/hub/types.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** 构建 ToolContext */
function makeCtx(args: Record<string, unknown>): ToolContext {
  return {
    installationId: "inst-001",
    botId: "bot-001",
    userId: "user-001",
    traceId: "trace-001",
    args,
  };
}

describe("rssTools", () => {
  let store: Store;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rss-tools-test-"));
    store = new Store(path.join(tmpDir, "test.db"));
  });

  afterEach(() => {
    store.close();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("定义了 4 个工具", () => {
    expect(rssTools.definitions).toHaveLength(4);
    expect(rssTools.definitions.map((d) => d.name)).toEqual([
      "subscribe_feed",
      "list_feeds",
      "unsubscribe_feed",
      "check_feeds",
    ]);
  });

  describe("subscribe_feed", () => {
    it("缺少 url 参数返回错误", async () => {
      const handlers = rssTools.createHandlers({ store });
      const handler = handlers.get("subscribe_feed")!;
      const result = await handler(makeCtx({}));
      expect(result).toContain("错误");
      expect(result).toContain("url");
    });

    it("RSS 解析失败返回错误", async () => {
      // parseFeed 会因为 URL 无效而失败
      const handlers = rssTools.createHandlers({ store });
      const handler = handlers.get("subscribe_feed")!;
      const result = await handler(makeCtx({ url: "not-a-valid-url" }));
      expect(result).toContain("订阅失败");
    });
  });

  describe("list_feeds", () => {
    it("无订阅时返回提示", async () => {
      const handlers = rssTools.createHandlers({ store });
      const handler = handlers.get("list_feeds")!;
      const result = await handler(makeCtx({}));
      expect(result).toContain("暂无订阅");
    });

    it("有订阅时返回列表", async () => {
      store.addFeed("inst-001", "user-001", "https://example.com/feed", "示例博客");
      const handlers = rssTools.createHandlers({ store });
      const handler = handlers.get("list_feeds")!;
      const result = await handler(makeCtx({}));
      expect(result).toContain("示例博客");
      expect(result).toContain("1 个");
    });
  });

  describe("unsubscribe_feed", () => {
    it("缺少 feed_id 参数返回错误", async () => {
      const handlers = rssTools.createHandlers({ store });
      const handler = handlers.get("unsubscribe_feed")!;
      const result = await handler(makeCtx({}));
      expect(result).toContain("错误");
      expect(result).toContain("feed_id");
    });

    it("不存在的 feed 返回错误", async () => {
      const handlers = rssTools.createHandlers({ store });
      const handler = handlers.get("unsubscribe_feed")!;
      const result = await handler(makeCtx({ feed_id: 9999 }));
      expect(result).toContain("未找到");
    });

    it("成功取消订阅", async () => {
      const feed = store.addFeed("inst-001", "user-001", "https://example.com/feed", "示例博客");
      const handlers = rssTools.createHandlers({ store });
      const handler = handlers.get("unsubscribe_feed")!;
      const result = await handler(makeCtx({ feed_id: feed.id }));
      expect(result).toContain("已取消订阅");
      expect(result).toContain("示例博客");
    });

    it("无权操作他人订阅", async () => {
      const feed = store.addFeed("inst-001", "user-002", "https://example.com/feed", "他人博客");
      const handlers = rssTools.createHandlers({ store });
      const handler = handlers.get("unsubscribe_feed")!;
      const result = await handler(makeCtx({ feed_id: feed.id }));
      expect(result).toContain("无权");
    });
  });

  describe("check_feeds", () => {
    it("无 checkFeeds 回调返回错误", async () => {
      const handlers = rssTools.createHandlers({ store });
      const handler = handlers.get("check_feeds")!;
      const result = await handler(makeCtx({}));
      expect(result).toContain("错误");
    });

    it("调用 checkFeeds 回调", async () => {
      const mockCheckFeeds = vi.fn().mockResolvedValue("检查完成，共 2 条新文章");
      const handlers = rssTools.createHandlers({ store, checkFeeds: mockCheckFeeds });
      const handler = handlers.get("check_feeds")!;
      const result = await handler(makeCtx({}));
      expect(result).toBe("检查完成，共 2 条新文章");
      expect(mockCheckFeeds).toHaveBeenCalledWith("inst-001", "user-001");
    });
  });
});
