import crypto from "node:crypto";

const KEY_PREFIX = "sk_live_";

/** The plaintext is shown to the caller exactly once - only the hash is stored. */
export function generateApiKey(): { plaintext: string; prefix: string; hash: string } {
  const random = crypto.randomBytes(24).toString("hex");
  const plaintext = `${KEY_PREFIX}${random}`;
  return { plaintext, prefix: plaintext.slice(0, 12), hash: hashApiKey(plaintext) };
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function parseBearerApiKey(authorizationHeader: string | null): string | null {
  const match = /^Bearer\s+(sk_live_[a-f0-9]+)$/.exec((authorizationHeader ?? "").trim());
  return match ? match[1] : null;
}
