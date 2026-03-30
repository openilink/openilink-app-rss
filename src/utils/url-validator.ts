/**
 * URL 安全校验工具 — 防止 SSRF 攻击
 *
 * 校验规则：
 * 1. 只允许 http:// 和 https:// 协议
 * 2. 禁止私有 IP 段：10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x
 * 3. 禁止 localhost、0.0.0.0
 */

/** 私有/保留 IP 正则列表 */
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^127\./,             // 回环地址 127.0.0.0/8
  /^10\./,              // 私有网段 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // 私有网段 172.16.0.0/12
  /^192\.168\./,        // 私有网段 192.168.0.0/16
  /^169\.254\./,        // 链路本地地址 169.254.0.0/16
  /^0\./,               // 0.0.0.0/8
];

/** 禁止的主机名（不区分大小写） */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "[::1]",
  "[::0]",
  "[0:0:0:0:0:0:0:0]",
  "[0:0:0:0:0:0:0:1]",
]);

/**
 * 校验 URL 是否安全可访问（防 SSRF）
 * @param url 待校验的 URL 字符串
 * @returns 是否允许访问
 */
export function isAllowedUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // URL 解析失败，拒绝访问
    return false;
  }

  // 只允许 http 和 https 协议
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // 检查禁止的主机名
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return false;
  }

  // 检查私有/保留 IP 地址
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return false;
    }
  }

  return true;
}
