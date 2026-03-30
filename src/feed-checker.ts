/**
 * RSS Feed 定时检查器
 *
 * 每 5 分钟检查所有启用的 feed：
 * 1. rss-parser 解析 feed
 * 2. 对比 guid 判断是否为新条目
 * 3. 新条目存入 feed_items 表
 * 4. 通过 HubClient 推送通知
 *
 * 推送格式: "📰 {feedTitle}\n{itemTitle}\n{link}"
 */

import { Store } from "./store.js";
import { HubClient } from "./hub/client.js";
import type { Installation } from "./hub/types.js";
import { parseFeed } from "./tools/rss.js";

/** 检查间隔：5 分钟 */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** Feed 检查器 */
export class FeedChecker {
  private store: Store;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(store: Store) {
    this.store = store;
  }

  /** 启动定时检查 */
  start(): void {
    console.log("[feed-checker] 启动定时检查，间隔 5 分钟");
    // 启动后立即执行一次
    this.checkAll().catch((err) => console.error("[feed-checker] 首次检查失败:", err));
    this.timer = setInterval(() => {
      this.checkAll().catch((err) => console.error("[feed-checker] 定时检查失败:", err));
    }, CHECK_INTERVAL_MS);
  }

  /** 停止定时检查 */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[feed-checker] 定时检查已停止");
    }
  }

  /**
   * 检查所有启用的 feed
   * @returns 新增条目总数
   */
  async checkAll(): Promise<number> {
    const feeds = this.store.getEnabledFeeds();
    if (feeds.length === 0) return 0;

    console.log(`[feed-checker] 开始检查 ${feeds.length} 个订阅源`);
    let totalNew = 0;

    for (const feed of feeds) {
      try {
        const newCount = await this.checkOneFeed(feed.id);
        totalNew += newCount;
      } catch (err) {
        console.error(`[feed-checker] 检查 feed ${feed.id} (${feed.url}) 失败:`, err);
      }
    }

    console.log(`[feed-checker] 检查完成，共 ${totalNew} 条新文章`);
    return totalNew;
  }

  /**
   * 检查单个 feed 并推送新条目
   * @param feedId feed ID
   * @returns 新增条目数
   */
  async checkOneFeed(feedId: number): Promise<number> {
    const feed = this.store.getFeed(feedId);
    if (!feed || !feed.enabled) return 0;

    // 解析 RSS
    const parsed = await parseFeed(feed.url);
    let newCount = 0;

    for (const item of parsed.items || []) {
      const guid = item.guid || item.link || item.title || "";
      if (!guid) continue;

      const title = item.title || "";
      const link = item.link || "";
      const published = item.pubDate || item.isoDate || new Date().toISOString();

      // 尝试插入（guid 唯一，重复会被忽略）
      const isNew = this.store.insertFeedItem(feedId, guid, title, link, published);
      if (isNew) {
        newCount++;
      }
    }

    // 更新最后检查时间
    this.store.updateFeedLastCheck(feedId, new Date().toISOString());

    // 推送未通知的条目
    await this.notifyNewItems(feedId, feed.title);

    return newCount;
  }

  /**
   * 推送指定 feed 的未通知条目
   * @param feedId feed ID
   * @param feedTitle feed 标题
   */
  private async notifyNewItems(feedId: number, feedTitle: string): Promise<void> {
    const items = this.store.getUnnotifiedItems(feedId);
    if (items.length === 0) return;

    const feed = this.store.getFeed(feedId);
    if (!feed) return;

    // 获取安装实例
    const installation = this.store.getInstallation(feed.installation_id);
    if (!installation) {
      console.warn(`[feed-checker] 未找到安装记录: ${feed.installation_id}`);
      return;
    }

    const hubClient = new HubClient(installation.hubUrl, installation.appToken);

    for (const item of items) {
      const message = `📰 ${feedTitle}\n${item.title}\n${item.link}`;
      try {
        // 推送给订阅者
        await hubClient.sendText(feed.user_id, message);
        this.store.markItemNotified(item.id);
      } catch (err) {
        console.error(`[feed-checker] 推送条目 ${item.id} 失败:`, err);
      }
    }
  }

  /**
   * 手动检查指定用户的所有 feed（由 check_feeds 工具调用）
   * @param installationId 安装实例 ID
   * @param userId 用户 ID
   * @returns 结果描述文本
   */
  async checkUserFeeds(installationId: string, userId: string): Promise<string> {
    const feeds = this.store.getUserFeeds(installationId, userId);
    if (feeds.length === 0) {
      return "暂无订阅，请先使用 subscribe_feed 添加 RSS 源";
    }

    let totalNew = 0;
    const results: string[] = [];

    for (const feed of feeds) {
      if (!feed.enabled) continue;
      try {
        const newCount = await this.checkOneFeed(feed.id);
        totalNew += newCount;
        results.push(`✅ ${feed.title}: ${newCount} 条新文章`);
      } catch (err: any) {
        results.push(`❌ ${feed.title}: ${err.message || "检查失败"}`);
      }
    }

    return `检查完成，共 ${totalNew} 条新文章\n\n${results.join("\n")}`;
  }
}
