/**
 * 应用配置接口与加载逻辑
 */

/** 全局配置项 */
export interface Config {
  /** HTTP 服务端口，默认 "8097" */
  port: string;
  /** Hub 服务地址，必填 */
  hubUrl: string;
  /** 本 App 的公网回调地址，必填 */
  baseUrl: string;
  /** SQLite 数据库文件路径，默认 "data/rss.db" */
  dbPath: string;
}

/** 从环境变量加载配置 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const config: Config = {
    port: env.PORT?.trim() || "8097",
    hubUrl: env.HUB_URL?.trim() || "",
    baseUrl: env.BASE_URL?.trim() || "",
    dbPath: env.DB_PATH?.trim() || "data/rss.db",
  };

  // 校验必填项
  const required: (keyof Config)[] = ["hubUrl", "baseUrl"];
  for (const key of required) {
    if (!config[key]) {
      throw new Error(`缺少必填配置: ${key}（对应环境变量: ${toEnvName(key)}）`);
    }
  }

  return config;
}

/** 将 camelCase 转为 UPPER_SNAKE_CASE */
function toEnvName(key: string): string {
  return key.replace(/([A-Z])/g, "_$1").toUpperCase();
}
