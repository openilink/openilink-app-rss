/**
 * RSS 工具模块 — 订阅、列表、取消订阅、立即检查
 */

import type { ToolModule, ToolDefinition, ToolHandler, ToolModuleDeps } from "../hub/types.js";
import type { Store } from "../store.js";
import RssParser from "rss-parser";
import { isAllowedUrl } from "../utils/url-validator.js";

/** RSS 解析器实例（10 秒超时，防止慢响应阻塞） */
const parser = new RssParser({ timeout: 10_000 });

/** 工具定义 */
const definitions: ToolDefinition[] = [
  {
    name: "subscribe_feed",
    description: "订阅一个 RSS 源，验证 URL 有效性后保存",
    command: "subscribe_feed",
    parameters: {
      url: { type: "string", description: "RSS 源 URL", required: true },
    },
  },
  {
    name: "list_feeds",
    description: "查看当前用户的 RSS 订阅列表",
    command: "list_feeds",
    parameters: {},
  },
  {
    name: "unsubscribe_feed",
    description: "取消订阅指定的 RSS 源",
    command: "unsubscribe_feed",
    parameters: {
      feed_id: { type: "number", description: "订阅 ID", required: true },
    },
  },
  {
    name: "check_feeds",
    description: "立即检查所有订阅的 RSS 源更新",
    command: "check_feeds",
    parameters: {},
  },
];

/**
 * 验证并解析 RSS 源
 * @param url RSS 源地址
 * @returns 解析后的 feed 对象
 */
export async function parseFeed(url: string): Promise<RssParser.Output<Record<string, unknown>>> {
  return await parser.parseURL(url);
}

/** 创建处理函数 */
function createHandlers(deps?: ToolModuleDeps): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();
  const store = deps?.store as Store | undefined;

  handlers.set("subscribe_feed", async (ctx) => {
    if (!store) return "错误：存储服务不可用";

    const { url } = ctx.args;
    if (!url || typeof url !== "string") {
      return "错误：请提供 RSS 源 URL（url）";
    }

    // SSRF 防护：校验 URL 安全性
    if (!isAllowedUrl(String(url))) {
      return "错误：不允许的 URL，仅支持公网 HTTP/HTTPS 地址";
    }

    try {
      // 验证 RSS 有效性
      const feed = await parseFeed(String(url));
      const title = feed.title || url;

      // 去重检查：同一用户不可重复订阅相同 URL
      if (store.feedExists(ctx.installationId, ctx.userId, String(url))) {
        return `已存在相同订阅: ${title}`;
      }

      // 保存订阅
      store.addFeed(ctx.installationId, ctx.userId, String(url), title);

      return `已订阅: ${title}`;
    } catch (err: any) {
      return `订阅失败：${err.message || "无法解析 RSS 源"}`;
    }
  });

  handlers.set("list_feeds", async (ctx) => {
    if (!store) return "错误：存储服务不可用";

    const feeds = store.getUserFeeds(ctx.installationId, ctx.userId);
    if (feeds.length === 0) {
      return "暂无订阅，使用 subscribe_feed 添加 RSS 源";
    }

    const lines = feeds.map((f) => {
      const status = f.enabled ? "✅" : "❌";
      return `${status} [${f.id}] ${f.title}\n   ${f.url}`;
    });

    return `📰 你的 RSS 订阅（共 ${feeds.length} 个）：\n\n${lines.join("\n\n")}`;
  });

  handlers.set("unsubscribe_feed", async (ctx) => {
    if (!store) return "错误：存储服务不可用";

    const { feed_id } = ctx.args;
    if (feed_id == null) {
      return "错误：请提供订阅 ID（feed_id）";
    }

    const id = Number(feed_id);
    const feed = store.getFeed(id, ctx.installationId, ctx.userId);
    if (!feed) {
      return `错误：未找到 ID 为 ${id} 的订阅，或无权操作`;
    }

    store.deleteFeed(id, ctx.installationId, ctx.userId);
    return `已取消订阅: ${feed.title}`;
  });

  handlers.set("check_feeds", async (ctx) => {
    if (!deps?.checkFeeds) {
      return "错误：检查服务不可用";
    }

    return await deps.checkFeeds(ctx.installationId, ctx.userId);
  });

  return handlers;
}

export const rssTools: ToolModule = { definitions, createHandlers };
