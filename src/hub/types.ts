/**
 * Hub 协议相关类型定义
 */

/** Hub 推送的事件结构 */
export interface HubEvent {
  /** 协议版本 */
  v: number;
  /** 事件类型：event / url_verification */
  type: "event" | "url_verification";
  /** 链路追踪 ID */
  trace_id: string;
  /** 握手挑战值（type=url_verification 时存在） */
  challenge?: string;
  /** 安装实例 ID */
  installation_id: string;
  /** 关联的 Bot 信息 */
  bot: {
    id: string;
  };
  /** 业务事件载荷（type=event 时存在） */
  event?: {
    /** 事件子类型：message / command 等 */
    type: string;
    /** 事件唯一 ID */
    id: string;
    /** 事件发生时间戳 */
    timestamp: number;
    /** 事件数据 */
    data: EventData;
  };
}

/** 事件数据 */
export interface EventData {
  /** 发送者信息 */
  sender?: { id: string; name?: string };
  /** 群组信息 */
  group?: { id: string; name?: string };
  /** 命令名称（command 事件） */
  command?: string;
  /** 命令参数（command 事件） */
  args?: Record<string, unknown>;
  /** 其他扩展字段 */
  [key: string]: unknown;
}

/** OAuth 凭证交换响应 */
export interface OAuthExchangeResult {
  /** 安装实例 ID */
  installation_id: string;
  /** 应用访问令牌 */
  app_token: string;
  /** Webhook 签名密钥 */
  webhook_secret: string;
  /** Bot ID */
  bot_id: string;
}

/** 安装实例记录 */
export interface Installation {
  /** 安装实例 ID */
  id: string;
  /** Hub 服务地址 */
  hubUrl: string;
  /** 应用 ID */
  appId: string;
  /** Bot ID */
  botId: string;
  /** 应用访问令牌 */
  appToken: string;
  /** Webhook 签名密钥 */
  webhookSecret: string;
  /** 创建时间 */
  createdAt?: string;
}

/** AI Tool 定义 */
export interface ToolDefinition {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 触发指令 */
  command: string;
  /** JSON Schema 参数定义 */
  parameters?: Record<string, unknown>;
}

/** AI Tool 执行上下文 */
export interface ToolContext {
  /** 安装实例 ID */
  installationId: string;
  /** Bot ID */
  botId: string;
  /** 触发用户 ID */
  userId: string;
  /** 链路追踪 ID */
  traceId: string;
  /** 工具参数 */
  args: Record<string, any>;
}

/** AI Tool 处理函数类型 */
export type ToolHandler = (ctx: ToolContext) => Promise<string>;

/** 工具模块接口 */
export interface ToolModule {
  /** 工具定义列表 */
  definitions: ToolDefinition[];
  /** 创建工具处理函数映射 */
  createHandlers: (deps?: ToolModuleDeps) => Map<string, ToolHandler>;
}

/** 工具模块依赖（可选） */
export interface ToolModuleDeps {
  /** Store 实例，用于需要数据库操作的工具 */
  store?: any;
  /** 触发 feed 检查的回调 */
  checkFeeds?: (installationId: string, userId: string) => Promise<string>;
}
