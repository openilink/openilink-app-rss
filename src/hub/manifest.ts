/**
 * 应用清单定义
 *
 * 向 Hub 注册时使用的元信息，包含应用名称、图标、订阅的事件类型等。
 */

/** 应用清单结构 */
export interface AppManifest {
  /** 应用唯一标识（URL 友好） */
  slug: string;
  /** 应用显示名称 */
  name: string;
  /** 应用图标（emoji 或 URL） */
  icon: string;
  /** 应用描述 */
  description: string;
  /** 订阅的事件类型列表 */
  events: string[];
  /** 配置表单 JSON Schema */
  config_schema?: Record<string, unknown>;
  /** 安装引导说明（Markdown） */
  guide?: string;
}

/** RSS 订阅推送应用清单 */
export const manifest: AppManifest = {
  slug: "rss",
  name: "RSS 订阅推送",
  icon: "📰",
  description: "订阅 RSS 源，自动推送新文章通知",
  events: ["command"],
  config_schema: {},
};
