/**
 * Hub Bot API 客户端
 *
 * 封装与 Hub 的 HTTP 通信，提供发送消息、同步工具定义等能力。
 * Bot API: POST {hubUrl}/bot/v1/message/send
 */

import type { ToolDefinition } from "./types.js";

/** 发送消息请求参数 */
export interface SendMessageParams {
  /** 目标用户/群组 ID */
  to: string;
  /** 消息类型（text / image / file 等） */
  type: string;
  /** 消息内容 */
  content: string;
  /** 媒体 URL（可选） */
  url?: string;
  /** 媒体 base64 数据（可选） */
  base64?: string;
  /** 文件名（可选） */
  filename?: string;
  /** 链路追踪 ID（可选） */
  trace_id?: string;
}

/**
 * Hub Bot API 客户端
 * 通过 appToken 认证，向 Hub 发送消息和同步工具
 */
export class HubClient {
  private hubUrl: string;
  private appToken: string;

  constructor(hubUrl: string, appToken: string) {
    // 移除末尾斜杠
    this.hubUrl = hubUrl.replace(/\/+$/, "");
    this.appToken = appToken;
  }

  /**
   * 发送文本消息
   * @param to 目标用户/群组 ID
   * @param text 文本内容
   * @param traceId 可选的追踪 ID
   */
  async sendText(to: string, text: string, traceId?: string): Promise<void> {
    await this.sendMessage({ to, type: "text", content: text, trace_id: traceId });
  }

  /**
   * 发送消息（支持媒体类型）
   * POST {hubUrl}/bot/v1/message/send
   * body: {to, type, content, url?, base64?, filename?, trace_id?}
   */
  async sendMessage(params: SendMessageParams): Promise<void> {
    const url = `${this.hubUrl}/bot/v1/message/send`;

    const payload: Record<string, string | undefined> = {
      to: params.to,
      type: params.type,
      content: params.content,
    };
    if (params.url) payload.url = params.url;
    if (params.base64) payload.base64 = params.base64;
    if (params.filename) payload.filename = params.filename;
    if (params.trace_id) payload.trace_id = params.trace_id;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.appToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(
        `[hub-client] 发送消息失败: ${resp.status} ${resp.statusText} - ${errText}`,
      );
    }
  }

  /**
   * 同步工具定义到 Hub（PUT /bot/v1/app/tools）
   */
  async syncTools(tools: ToolDefinition[]): Promise<void> {
    const url = `${this.hubUrl}/bot/v1/app/tools`;
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.appToken}`,
      },
      body: JSON.stringify({ tools }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[hub-client] syncTools 失败 [${resp.status}]: ${errText}`);
    }
  }
}
