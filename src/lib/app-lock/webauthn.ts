"use client";

export type WebAuthnSupport = {
  supported: boolean;
  platformAuthenticatorAvailable: boolean | null;
  reason?: "insecure_context" | "missing_api" | "unavailable";
};

export type WebAuthnResult<T = void> =
  | { ok: true; value: T }
  | {
      ok: false;
      code:
        | "not_supported"
        | "cancelled"
        | "timeout"
        | "failed"
        | "security"
        | "unknown";
      message?: string;
    };

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(base64url: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function randomChallenge(length = 32): Uint8Array {
  const challenge = new Uint8Array(length);
  crypto.getRandomValues(challenge);
  return challenge;
}

function mapError(err: unknown): WebAuthnResult<never> {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") {
      return { ok: false, code: "cancelled", message: err.message };
    }
    if (err.name === "NotSupportedError") {
      return { ok: false, code: "not_supported", message: err.message };
    }
    if (err.name === "SecurityError") {
      return { ok: false, code: "security", message: err.message };
    }
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return { ok: false, code: "timeout", message: err.message };
    }
    return { ok: false, code: "failed", message: err.message || err.name };
  }
  return {
    ok: false,
    code: "unknown",
    message: err instanceof Error ? err.message : String(err),
  };
}

export async function getWebAuthnSupport(): Promise<WebAuthnSupport> {
  if (typeof window === "undefined" || !window.isSecureContext) {
    return {
      supported: false,
      platformAuthenticatorAvailable: null,
      reason: "insecure_context",
    };
  }

  if (!window.PublicKeyCredential || !navigator.credentials) {
    return {
      supported: false,
      platformAuthenticatorAvailable: null,
      reason: "missing_api",
    };
  }

  try {
    const available =
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
      "function"
        ? await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        : null;

    if (available === false) {
      return {
        supported: false,
        platformAuthenticatorAvailable: false,
        reason: "unavailable",
      };
    }

    return {
      supported: true,
      platformAuthenticatorAvailable: available ?? null,
    };
  } catch {
    return {
      supported: true,
      platformAuthenticatorAvailable: null,
    };
  }
}

export async function registerPlatformCredential(opts: {
  userName: string;
  displayName: string;
}): Promise<WebAuthnResult<{ credentialId: string }>> {
  const support = await getWebAuthnSupport();
  if (!support.supported) {
    return { ok: false, code: "not_supported" };
  }

  try {
    const userId = randomChallenge(16);
    const challenge = randomChallenge(32);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: challenge as BufferSource,
        rp: {
          name: "Pocketly",
          id: window.location.hostname,
        },
        user: {
          id: userId as BufferSource,
          name: opts.userName || "pocketly-user",
          displayName: opts.displayName || "Pocketly User",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "preferred",
          userVerification: "required",
        },
        timeout: 60_000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { ok: false, code: "failed", message: "No credential returned" };
    }

    return { ok: true, value: { credentialId: toBase64Url(credential.rawId) } };
  } catch (err) {
    return mapError(err);
  }
}

export async function authenticatePlatformCredential(opts: {
  credentialId: string;
  timeout?: number;
}): Promise<WebAuthnResult<void>> {
  const support = await getWebAuthnSupport();
  if (!support.supported) {
    return { ok: false, code: "not_supported" };
  }

  try {
    const challenge = randomChallenge(32);
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge as BufferSource,
        allowCredentials: [
          {
            id: fromBase64Url(opts.credentialId),
            type: "public-key",
            transports: ["internal", "hybrid"],
          },
        ],
        userVerification: "required",
        timeout: opts.timeout ?? 60_000,
      },
    });

    if (!assertion) {
      return { ok: false, code: "failed", message: "No assertion returned" };
    }

    return { ok: true, value: undefined };
  } catch (err) {
    return mapError(err);
  }
}
