/**
 * OAuth PKCE 授权流程处理
 *
 * 流程：
 * 1. 用户访问 /oauth/setup?hub=...&app_id=...&bot_id=...&state=...&return_url=...
 *    → 生成 PKCE 码对，重定向到 Hub 授权页 /api/apps/{appId}/oauth/authorize
 * 2. Hub 回调 /oauth/redirect?code=xxx&state=xxx
 *    → 用 code + code_verifier 向 /api/apps/{appId}/oauth/exchange 换取凭证
 * 3. 将安装信息持久化到 Store
 * 4. 安装成功后同步工具定义到 Hub
 * 5. 回调完成后重定向到 returnUrl
 */

import { generatePKCE } from "../utils/crypto.js";
import type { Store } from "../store.js";
import type { Config } from "../config.js";
import type { OAuthExchangeResult, Installation, ToolDefinition } from "./types.js";
import { HubClient } from "./client.js";
import type { IncomingMessage, ServerResponse } from "node:http";

/** PKCE 缓存条目 */
interface PKCEEntry {
  verifier: string;
  hub: string;
  appId: string;
  botId: string;
  returnUrl: string;
  expiresAt: number;
}

/** PKCE 缓存，key 为 state，10 分钟过期 */
const pkceCache = new Map<string, PKCEEntry>();

/** 缓存过期时间：10 分钟 */
const PKCE_TTL_MS = 10 * 60 * 1000;

/** 清理过期的 PKCE 条目 */
function cleanExpired(): void {
  const now = Date.now();
  for (const [key, entry] of pkceCache) {
    if (entry.expiresAt < now) {
      pkceCache.delete(key);
    }
  }
}

/** OAuth 处理器配置 */
export interface OAuthOptions {
  config: Config;
  store: Store;
  /** 工具定义列表，OAuth 成功后同步到 Hub */
  tools?: ToolDefinition[];
}

/**
 * 处理 OAuth 安装流程第一步：生成 PKCE 并重定向到 Hub 授权页
 * 路由: GET /oauth/setup?hub=...&app_id=...&bot_id=...&state=...&return_url=...
 */
export function handleOAuthStart(
  req: IncomingMessage,
  res: ServerResponse,
  opts: OAuthOptions,
): void {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const params = url.searchParams;

  const hub = params.get("hub") ?? opts.config.hubUrl;
  const appId = params.get("app_id") ?? "";
  const botId = params.get("bot_id") ?? "";
  const state = params.get("state") ?? "";
  const returnUrl = params.get("return_url") ?? "";

  if (!hub || !appId || !botId || !state) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "缺少必填参数: hub, app_id, bot_id, state" }));
    return;
  }

  // 清理过期缓存
  cleanExpired();

  // 生成 PKCE
  const { verifier, challenge } = generatePKCE();
  pkceCache.set(state, {
    verifier,
    hub,
    appId,
    botId,
    returnUrl,
    expiresAt: Date.now() + PKCE_TTL_MS,
  });

  // 构建 Hub 授权 URL: /api/apps/{appId}/oauth/authorize
  const redirectUri = `${opts.config.baseUrl}/oauth/redirect`;
  const authUrl = new URL(`${hub}/api/apps/${appId}/oauth/authorize`);
  authUrl.searchParams.set("app_id", appId);
  authUrl.searchParams.set("bot_id", botId);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("code_challenge", challenge);
  if (returnUrl) {
    authUrl.searchParams.set("return_url", returnUrl);
  }

  // 重定向到 Hub 授权页
  res.writeHead(302, { Location: authUrl.toString() });
  res.end();
}

/**
 * 处理 OAuth 安装流程第二步：用授权码 + code_verifier 换取凭证并保存
 * 路由: GET /oauth/redirect?code=xxx&state=xxx
 * 交换接口: POST /api/apps/{appId}/oauth/exchange  body: {code, code_verifier}
 * 成功后重定向到 returnUrl
 */
export async function handleOAuthCallback(
  req: IncomingMessage,
  res: ServerResponse,
  opts: OAuthOptions,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const params = url.searchParams;

  const code = params.get("code") ?? "";
  const state = params.get("state") ?? "";

  if (!code || !state) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "缺少必填参数: code, state" }));
    return;
  }

  // 清理过期缓存
  cleanExpired();

  // 从缓存取出 PKCE verifier
  const pkceEntry = pkceCache.get(state);
  if (!pkceEntry) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "PKCE 状态无效或已过期" }));
    return;
  }
  pkceCache.delete(state);

  try {
    // 向 Hub 交换凭证: POST /api/apps/{appId}/oauth/exchange
    const exchangeUrl = `${pkceEntry.hub}/api/apps/${pkceEntry.appId}/oauth/exchange`;
    const exchangeRes = await fetch(exchangeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: pkceEntry.verifier,
      }),
    });

    if (!exchangeRes.ok) {
      const errText = await exchangeRes.text();
      console.error("[oauth] 凭证交换失败:", exchangeRes.status, errText);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "凭证交换失败", detail: errText }));
      return;
    }

    const result = (await exchangeRes.json()) as OAuthExchangeResult;

    // 保存安装信息
    const installation: Installation = {
      id: result.installation_id,
      hubUrl: pkceEntry.hub,
      appId: pkceEntry.appId,
      botId: result.bot_id,
      appToken: result.app_token,
      webhookSecret: result.webhook_secret,
      createdAt: new Date().toISOString(),
    };
    opts.store.saveInstallation(installation);

    console.log("[oauth] 安装成功, installation_id:", result.installation_id);

    // OAuth 成功后同步工具定义到 Hub
    if (opts.tools && opts.tools.length > 0) {
      const hubClient = new HubClient(pkceEntry.hub, result.app_token);
      hubClient.syncTools(opts.tools).catch((err) => {
        console.error("[oauth] 同步工具定义失败:", err);
      });
    }

    // 回调完成后重定向到 returnUrl
    if (pkceEntry.returnUrl) {
      res.writeHead(302, { Location: pkceEntry.returnUrl });
      res.end();
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, installation_id: result.installation_id }));
    }
  } catch (err) {
    console.error("[oauth] 凭证交换异常:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "凭证交换过程发生异常" }));
  }
}
