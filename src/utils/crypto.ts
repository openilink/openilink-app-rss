/**
 * 加密工具：HMAC 签名验证 + PKCE 码生成
 */

import { createHmac, randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * 验证 Webhook 签名
 * 签名算法: HMAC-SHA256(secret, timestamp + ":" + body)
 * 签名格式: "sha256=" + hex
 * 使用 timingSafeEqual 防止时序攻击
 *
 * @param secret - Webhook 密钥
 * @param timestamp - 请求头 X-Timestamp 的值
 * @param body - 原始请求体（Buffer）
 * @param signature - 请求头 X-Signature 的值
 * @returns 签名是否匹配
 */
export function verifySignature(
  secret: string,
  timestamp: string,
  body: Buffer,
  signature: string,
): boolean {
  const mac = createHmac("sha256", secret);
  mac.update(timestamp + ":");
  mac.update(body);
  const expected = "sha256=" + mac.digest("hex");

  // 长度不一致时直接返回 false，避免 timingSafeEqual 抛异常
  if (expected.length !== signature.length) return false;

  return timingSafeEqual(
    Buffer.from(expected, "utf-8"),
    Buffer.from(signature, "utf-8"),
  );
}

/** PKCE 码对 */
export interface PKCEPair {
  /** 随机生成的 code_verifier */
  verifier: string;
  /** 对应的 code_challenge（S256，base64url 编码） */
  challenge: string;
}

/**
 * 生成 OAuth PKCE 码对（S256 方式，base64url 编码）
 * @returns verifier 与 challenge
 */
export function generatePKCE(): PKCEPair {
  // 生成 32 字节随机数，base64url 编码为 code_verifier
  const verifier = randomBytes(32).toString("base64url");

  // code_challenge = BASE64URL(SHA256(code_verifier))
  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");

  return { verifier, challenge };
}
