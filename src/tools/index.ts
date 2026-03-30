/**
 * 工具注册中心 — 汇总所有 RSS 工具模块
 */

import type { ToolDefinition, ToolHandler, ToolModuleDeps } from "../hub/types.js";
import { rssTools } from "./rss.js";

/** 所有工具模块 */
const allModules = [rssTools];

/**
 * 收集所有工具定义和处理函数
 * @param deps 工具模块依赖（store、checkFeeds 等）
 * @returns 工具定义列表和处理函数映射
 */
export function collectAllTools(deps?: ToolModuleDeps): {
  definitions: ToolDefinition[];
  handlers: Map<string, ToolHandler>;
} {
  const definitions: ToolDefinition[] = [];
  const handlers = new Map<string, ToolHandler>();

  for (const mod of allModules) {
    definitions.push(...mod.definitions);
    const moduleHandlers = mod.createHandlers(deps);
    for (const [name, handler] of moduleHandlers) {
      handlers.set(name, handler);
    }
  }

  return { definitions, handlers };
}
