/**
 * 命令路由器 —— 将 Hub 事件分发到对应的工具处理函数
 */

import type { HubEvent, ToolDefinition, ToolHandler, ToolContext } from "./hub/types.js";
import type { HubClient } from "./hub/client.js";
import type { Store } from "./store.js";

/** Router 构造参数 */
export interface RouterOptions {
  /** 工具定义列表 */
  definitions: ToolDefinition[];
  /** 工具处理函数映射（name → handler） */
  handlers: Map<string, ToolHandler>;
  /** Store 实例 */
  store: Store;
}

/**
 * 命令路由器
 *
 * 负责：
 * 1. 接收 Hub 推送的 command 类型事件
 * 2. 解析 command 名称，匹配对应的 ToolHandler
 * 3. 构建 ToolContext 并执行 handler
 */
export class Router {
  private definitions: ToolDefinition[];
  private handlers: Map<string, ToolHandler>;
  private store: Store;

  constructor(opts: RouterOptions) {
    this.definitions = opts.definitions;
    this.handlers = opts.handlers;
    this.store = opts.store;
  }

  /** 获取所有已注册的工具定义 */
  getDefinitions(): ToolDefinition[] {
    return this.definitions;
  }

  /** 处理 Hub 推送的 command 事件 */
  async handleCommand(event: HubEvent): Promise<string | undefined> {
    if (event.type !== "event" || !event.event || event.event.type !== "command") {
      return undefined;
    }

    const eventData = event.event.data;
    const command = (eventData.command as string) || "";
    const args = (eventData.args as Record<string, unknown>) || {};

    const handler = this.handlers.get(command);
    if (!handler) {
      return `未知命令：${command}。可用命令：${this.definitions.map((d) => d.command).join("、")}`;
    }

    // 构建执行上下文: userId 从 sender.id 取得
    const ctx: ToolContext = {
      installationId: event.installation_id,
      botId: event.bot.id,
      userId: eventData.sender?.id ?? "",
      traceId: event.trace_id,
      args,
    };

    try {
      const result = await handler(ctx);
      return result;
    } catch (err: any) {
      console.error(`[Router] 命令 ${command} 执行异常:`, err);
      return `命令执行失败：${err.message || "未知错误"}`;
    }
  }

  /** 完整处理流程：执行命令并通过 HubClient 异步推送结果 */
  async handleAndReply(event: HubEvent, hubClient: HubClient): Promise<void> {
    const result = await this.handleCommand(event);
    if (result === undefined) return;

    // 异步推送: to = data.group?.id ?? data.sender?.id
    const data = event.event?.data;
    const to = data?.group?.id ?? data?.sender?.id ?? "";
    if (to) {
      try {
        await hubClient.sendText(to, result, event.trace_id);
      } catch (err) {
        console.error("[Router] 回传工具结果失败:", err);
      }
    }
  }
}
