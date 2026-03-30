/**
 * SQLite 持久化存储层（基于 better-sqlite3）
 *
 * 包含 installations、feeds、feed_items 三张表
 */

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type { Installation } from "./hub/types.js";

/** Feed 订阅记录 */
export interface Feed {
  id: number;
  installation_id: string;
  user_id: string;
  url: string;
  title: string;
  last_check: string | null;
  enabled: number;
  created_at: string;
}

/** Feed 条目记录 */
export interface FeedItem {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  published: string;
  notified: number;
}

/** 数据库存储管理器 */
export class Store {
  private db: Database.Database;

  constructor(dbPath: string) {
    // 内存数据库不需要创建目录
    if (dbPath !== ":memory:") {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initTables();
  }

  /** 创建所需的数据表 */
  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS installations (
        id            TEXT PRIMARY KEY,
        hub_url       TEXT NOT NULL,
        app_id        TEXT NOT NULL,
        bot_id        TEXT NOT NULL,
        app_token     TEXT NOT NULL,
        webhook_secret TEXT NOT NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS feeds (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        installation_id TEXT NOT NULL,
        user_id         TEXT NOT NULL,
        url             TEXT NOT NULL,
        title           TEXT NOT NULL DEFAULT '',
        last_check      TEXT,
        enabled         INTEGER NOT NULL DEFAULT 1,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS feed_items (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_id   INTEGER NOT NULL,
        guid      TEXT NOT NULL,
        title     TEXT NOT NULL DEFAULT '',
        link      TEXT NOT NULL DEFAULT '',
        published TEXT NOT NULL DEFAULT '',
        notified  INTEGER NOT NULL DEFAULT 0,
        UNIQUE(feed_id, guid)
      );
    `);
  }

  // ─── Installation 操作 ─────────────────────────────────

  /** 保存或更新安装记录 */
  saveInstallation(inst: Installation): void {
    const stmt = this.db.prepare(`
      INSERT INTO installations (id, hub_url, app_id, bot_id, app_token, webhook_secret, created_at)
      VALUES (@id, @hubUrl, @appId, @botId, @appToken, @webhookSecret, @createdAt)
      ON CONFLICT(id) DO UPDATE SET
        hub_url        = excluded.hub_url,
        app_id         = excluded.app_id,
        bot_id         = excluded.bot_id,
        app_token      = excluded.app_token,
        webhook_secret = excluded.webhook_secret
    `);
    stmt.run({
      id: inst.id,
      hubUrl: inst.hubUrl,
      appId: inst.appId,
      botId: inst.botId,
      appToken: inst.appToken,
      webhookSecret: inst.webhookSecret,
      createdAt: inst.createdAt || new Date().toISOString(),
    });
  }

  /** 根据 ID 获取单条安装记录 */
  getInstallation(id: string): Installation | undefined {
    const row = this.db
      .prepare("SELECT * FROM installations WHERE id = ?")
      .get(id) as Record<string, string> | undefined;

    if (!row) return undefined;
    return this.rowToInstallation(row);
  }

  /** 获取所有安装记录 */
  getAllInstallations(): Installation[] {
    const rows = this.db
      .prepare("SELECT * FROM installations ORDER BY created_at DESC")
      .all() as Record<string, string>[];

    return rows.map((row) => this.rowToInstallation(row));
  }

  /** 将数据库行映射为 Installation 对象 */
  private rowToInstallation(row: Record<string, string>): Installation {
    return {
      id: row.id,
      hubUrl: row.hub_url,
      appId: row.app_id,
      botId: row.bot_id,
      appToken: row.app_token,
      webhookSecret: row.webhook_secret,
      createdAt: row.created_at,
    };
  }

  // ─── Feed 操作 ─────────────────────────────────────────

  /** 添加 Feed 订阅 */
  addFeed(installationId: string, userId: string, url: string, title: string): Feed {
    const stmt = this.db.prepare(`
      INSERT INTO feeds (installation_id, user_id, url, title)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(installationId, userId, url, title);
    return this.getFeed(Number(result.lastInsertRowid))!;
  }

  /** 获取单条 Feed */
  getFeed(id: number): Feed | undefined {
    return this.db
      .prepare("SELECT * FROM feeds WHERE id = ?")
      .get(id) as Feed | undefined;
  }

  /** 获取指定安装实例和用户的所有 Feed */
  getUserFeeds(installationId: string, userId: string): Feed[] {
    return this.db
      .prepare("SELECT * FROM feeds WHERE installation_id = ? AND user_id = ? ORDER BY created_at DESC")
      .all(installationId, userId) as Feed[];
  }

  /** 获取所有启用的 Feed */
  getEnabledFeeds(): Feed[] {
    return this.db
      .prepare("SELECT * FROM feeds WHERE enabled = 1 ORDER BY id")
      .all() as Feed[];
  }

  /** 删除 Feed 订阅 */
  deleteFeed(id: number): boolean {
    // 同时删除关联的 feed_items
    this.db.prepare("DELETE FROM feed_items WHERE feed_id = ?").run(id);
    const result = this.db.prepare("DELETE FROM feeds WHERE id = ?").run(id);
    return result.changes > 0;
  }

  /** 更新 Feed 最后检查时间 */
  updateFeedLastCheck(id: number, time: string): void {
    this.db.prepare("UPDATE feeds SET last_check = ? WHERE id = ?").run(time, id);
  }

  // ─── FeedItem 操作 ─────────────────────────────────────

  /** 尝试插入 Feed 条目（guid 唯一约束，忽略重复） */
  insertFeedItem(
    feedId: number,
    guid: string,
    title: string,
    link: string,
    published: string,
  ): boolean {
    try {
      this.db.prepare(`
        INSERT INTO feed_items (feed_id, guid, title, link, published)
        VALUES (?, ?, ?, ?, ?)
      `).run(feedId, guid, title, link, published);
      return true;
    } catch (err: any) {
      // UNIQUE 约束冲突表示该条目已存在，忽略
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE" || err.message?.includes("UNIQUE")) {
        return false;
      }
      throw err;
    }
  }

  /** 获取未通知的 Feed 条目 */
  getUnnotifiedItems(feedId: number): FeedItem[] {
    return this.db
      .prepare("SELECT * FROM feed_items WHERE feed_id = ? AND notified = 0 ORDER BY id")
      .all(feedId) as FeedItem[];
  }

  /** 标记 Feed 条目为已通知 */
  markItemNotified(id: number): void {
    this.db.prepare("UPDATE feed_items SET notified = 1 WHERE id = ?").run(id);
  }

  /** 关闭数据库连接 */
  close(): void {
    this.db.close();
  }
}
