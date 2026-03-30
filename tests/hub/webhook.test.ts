/**
 * Webhook 处理器测试
 */
import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { handleWebhook } from "../../src/hub/webhook.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { EventEmitter } from "node:events";

/** 创建模拟的 IncomingMessage */
function mockRequest(
  method: string,
  body: string,
  headers: Record<string, string> = {},
): IncomingMessage {
  const emitter = new EventEmitter() as any;
  emitter.method = method;
  emitter.url = "/hub/webhook";
  emitter.headers = headers;
  process.nextTick(() => {
    emitter.emit("data", Buffer.from(body));
    emitter.emit("end");
  });
  return emitter as IncomingMessage;
}

/** 创建模拟的 ServerResponse */
function mockResponse(): ServerResponse & { _statusCode: number; _body: string } {
  const res = {
    _statusCode: 0,
    _body: "",
    _headers: {} as Record<string, string>,
    headersSent: false,
    writeHead(statusCode: number, headers?: Record<string, string>) {
      res._statusCode = statusCode;
      if (headers) Object.assign(res._headers, headers);
      return res;
    },
    end(body?: string) {
      res._body = body || "";
      res.headersSent = true;
    },
  };
  return res as any;
}

/** 为 payload 生成 HMAC-SHA256 签名 */
function sign(payload: string, secret: string, timestamp: string): string {
  return "sha256=" + createHmac("sha256", secret).update(timestamp + ":").update(payload).digest("hex");
}

/** 模拟的 Store */
function mockStore(installations: Record<string, any> = {}) {
  return {
    getInstallation: vi.fn((id: string) => installations[id]),
    saveInstallation: vi.fn(),
    getAllInstallations: vi.fn(() => Object.values(installations)),
    close: vi.fn(),
  } as any;
}

describe("handleWebhook", () => {
  const webhookSecret = "test-secret-123";
  const installationId = "inst-001";
  const timestamp = String(Date.now());

  const installations: Record<string, any> = {
    [installationId]: {
      id: installationId,
      hubUrl: "https://hub.example.com",
      appId: "app-001",
      botId: "bot-001",
      appToken: "token-001",
      webhookSecret,
    },
  };

  const defaultOpts = {
    store: mockStore(installations),
    onCommand: vi.fn().mockResolvedValue("ok"),
    getHubClient: vi.fn().mockReturnValue({ sendText: vi.fn() }),
  };

  it("无效 JSON 返回 400", async () => {
    const req = mockRequest("POST", "not-json{{{");
    const res = mockResponse();
    await handleWebhook(req, res, defaultOpts);
    expect(res._statusCode).toBe(400);
  });

  it("url_verification 直接返回 challenge", async () => {
    const body = JSON.stringify({
      type: "url_verification",
      challenge: "test-challenge-value",
      installation_id: installationId,
      trace_id: "t1",
      bot: { id: "b1" },
    });
    const req = mockRequest("POST", body);
    const res = mockResponse();
    await handleWebhook(req, res, defaultOpts);

    expect(res._statusCode).toBe(200);
    const parsed = JSON.parse(res._body);
    expect(parsed.challenge).toBe("test-challenge-value");
  });

  it("未知安装实例返回 404", async () => {
    const body = JSON.stringify({
      type: "event", installation_id: "unknown-inst",
      trace_id: "t1", bot: { id: "b1" },
    });
    const req = mockRequest("POST", body);
    const res = mockResponse();
    await handleWebhook(req, res, defaultOpts);
    expect(res._statusCode).toBe(404);
  });

  it("缺少签名头返回 401", async () => {
    const body = JSON.stringify({
      type: "event", installation_id: installationId,
      trace_id: "t1", bot: { id: "b1" },
    });
    const req = mockRequest("POST", body);
    const res = mockResponse();
    await handleWebhook(req, res, defaultOpts);
    expect(res._statusCode).toBe(401);
  });

  it("签名验证失败返回 401", async () => {
    const body = JSON.stringify({
      type: "event", installation_id: installationId,
      trace_id: "t1", bot: { id: "b1" },
    });
    const req = mockRequest("POST", body, {
      "x-timestamp": timestamp,
      "x-signature": "sha256=invalid",
    });
    const res = mockResponse();
    await handleWebhook(req, res, defaultOpts);
    expect(res._statusCode).toBe(401);
  });

  it("正确签名的 command 事件返回 200", async () => {
    const body = JSON.stringify({
      type: "event", installation_id: installationId,
      trace_id: "t1", bot: { id: "b1" },
      event: {
        type: "command", id: "e1",
        timestamp: Date.now(),
        data: { command: "list_feeds", sender: { id: "user-001" } },
      },
    });
    const sig = sign(body, webhookSecret, timestamp);
    const req = mockRequest("POST", body, {
      "x-timestamp": timestamp,
      "x-signature": sig,
    });
    const res = mockResponse();
    await handleWebhook(req, res, defaultOpts);
    expect(res._statusCode).toBe(200);
  });
});
