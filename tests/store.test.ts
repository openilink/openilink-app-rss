/**
 * Store 持久化层测试
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Store } from "../src/store.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Store", () => {
  let store: Store;
  let dbPath: string;

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rss-store-test-"));
    dbPath = path.join(tmpDir, "test.db");
    store = new Store(dbPath);
  });

  afterEach(() => {
    store.close();
    const dir = path.dirname(dbPath);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ─── Installation 测试 ─────────────────────────────────

  describe("saveInstallation / getInstallation", () => {
    it("保存并读取安装记录", () => {
      const inst = {
        id: "inst-001",
        hubUrl: "https://hub.example.com",
        appId: "app-001",
        botId: "bot-001",
        appToken: "token-001",
        webhookSecret: "secret-001",
        createdAt: "2025-01-01T00:00:00.000Z",
      };

      store.saveInstallation(inst);
      const result = store.getInstallation("inst-001");

      expect(result).toBeDefined();
      expect(result!.id).toBe("inst-001");
      expect(result!.hubUrl).toBe("https://hub.example.com");
      expect(result!.appToken).toBe("token-001");
    });

    it("查询不存在的安装记录返回 undefined", () => {
      const result = store.getInstallation("nonexistent");
      expect(result).toBeUndefined();
    });

    it("更新已有的安装记录", () => {
      const inst = {
        id: "inst-001",
        hubUrl: "https://hub.example.com",
        appId: "app-001",
        botId: "bot-001",
        appToken: "old-token",
        webhookSecret: "old-secret",
      };

      store.saveInstallation(inst);
      store.saveInstallation({ ...inst, appToken: "new-token", webhookSecret: "new-secret" });

      const result = store.getInstallation("inst-001");
      expect(result!.appToken).toBe("new-token");
      expect(result!.webhookSecret).toBe("new-secret");
    });
  });

  describe("getAllInstallations", () => {
    it("返回所有安装记录", () => {
      store.saveInstallation({
        id: "inst-001", hubUrl: "https://hub.test", appId: "app-001",
        botId: "bot-001", appToken: "t1", webhookSecret: "s1",
      });
      store.saveInstallation({
        id: "inst-002", hubUrl: "https://hub.test", appId: "app-002",
        botId: "bot-002", appToken: "t2", webhookSecret: "s2",
      });

      const all = store.getAllInstallations();
      expect(all).toHaveLength(2);
    });

    it("空数据库返回空数组", () => {
      const all = store.getAllInstallations();
      expect(all).toEqual([]);
    });
  });

  // ─── Feed 测试 ─────────────────────────────────────────

  describe("addFeed / getFeed", () => {
    it("添加并读取 Feed 订阅", () => {
      const feed = store.addFeed("inst-001", "user-001", "https://example.com/feed.xml", "测试博客");
      expect(feed.id).toBeGreaterThan(0);
      expect(feed.installation_id).toBe("inst-001");
      expect(feed.user_id).toBe("user-001");
      expect(feed.url).toBe("https://example.com/feed.xml");
      expect(feed.title).toBe("测试博客");
      expect(feed.enabled).toBe(1);
    });

    it("查询不存在的 Feed 返回 undefined", () => {
      const result = store.getFeed(9999);
      expect(result).toBeUndefined();
    });
  });

  describe("getUserFeeds", () => {
    it("获取指定用户的所有订阅", () => {
      store.addFeed("inst-001", "user-001", "https://a.com/feed", "A 博客");
      store.addFeed("inst-001", "user-001", "https://b.com/feed", "B 博客");
      store.addFeed("inst-001", "user-002", "https://c.com/feed", "C 博客");

      const feeds = store.getUserFeeds("inst-001", "user-001");
      expect(feeds).toHaveLength(2);
    });

    it("无订阅时返回空数组", () => {
      const feeds = store.getUserFeeds("inst-001", "user-001");
      expect(feeds).toEqual([]);
    });
  });

  describe("getEnabledFeeds", () => {
    it("只返回启用的订阅", () => {
      store.addFeed("inst-001", "user-001", "https://a.com/feed", "A 博客");
      store.addFeed("inst-001", "user-001", "https://b.com/feed", "B 博客");

      const feeds = store.getEnabledFeeds();
      expect(feeds).toHaveLength(2);
      expect(feeds.every((f) => f.enabled === 1)).toBe(true);
    });
  });

  describe("deleteFeed", () => {
    it("删除 Feed 及其关联条目", () => {
      const feed = store.addFeed("inst-001", "user-001", "https://a.com/feed", "A 博客");
      store.insertFeedItem(feed.id, "guid-1", "文章1", "https://a.com/1", "2025-01-01");

      const deleted = store.deleteFeed(feed.id);
      expect(deleted).toBe(true);
      expect(store.getFeed(feed.id)).toBeUndefined();
      expect(store.getUnnotifiedItems(feed.id)).toEqual([]);
    });

    it("删除不存在的 Feed 返回 false", () => {
      const deleted = store.deleteFeed(9999);
      expect(deleted).toBe(false);
    });
  });

  // ─── FeedItem 测试 ────────────────────────────────────

  describe("insertFeedItem", () => {
    it("成功插入新条目", () => {
      const feed = store.addFeed("inst-001", "user-001", "https://a.com/feed", "A 博客");
      const inserted = store.insertFeedItem(feed.id, "guid-1", "文章1", "https://a.com/1", "2025-01-01");
      expect(inserted).toBe(true);
    });

    it("重复 guid 被忽略", () => {
      const feed = store.addFeed("inst-001", "user-001", "https://a.com/feed", "A 博客");
      store.insertFeedItem(feed.id, "guid-1", "文章1", "https://a.com/1", "2025-01-01");
      const inserted = store.insertFeedItem(feed.id, "guid-1", "文章1", "https://a.com/1", "2025-01-01");
      expect(inserted).toBe(false);
    });
  });

  describe("getUnnotifiedItems / markItemNotified", () => {
    it("获取未通知的条目并标记", () => {
      const feed = store.addFeed("inst-001", "user-001", "https://a.com/feed", "A 博客");
      store.insertFeedItem(feed.id, "guid-1", "文章1", "https://a.com/1", "2025-01-01");
      store.insertFeedItem(feed.id, "guid-2", "文章2", "https://a.com/2", "2025-01-02");

      const unnotified = store.getUnnotifiedItems(feed.id);
      expect(unnotified).toHaveLength(2);

      store.markItemNotified(unnotified[0].id);
      const remaining = store.getUnnotifiedItems(feed.id);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].guid).toBe("guid-2");
    });
  });

  describe("updateFeedLastCheck", () => {
    it("更新最后检查时间", () => {
      const feed = store.addFeed("inst-001", "user-001", "https://a.com/feed", "A 博客");
      expect(feed.last_check).toBeNull();

      const now = new Date().toISOString();
      store.updateFeedLastCheck(feed.id, now);

      const updated = store.getFeed(feed.id)!;
      expect(updated.last_check).toBe(now);
    });
  });
});
