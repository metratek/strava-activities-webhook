import { GOOGLE_TOKEN_URL } from "../config";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getGoogleAccessToken(
  email: string,
  privateKeyPem: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && now < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const jwt = await createSignedJwt(email, privateKeyPem, now);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${text}`);
  }

  const data: { access_token: string; expires_in: number } =
    await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in - 60, // refresh 60s early
  };

  return data.access_token;
}

async function createSignedJwt(
  email: string,
  privateKeyPem: string,
  nowSeconds: number
): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: GOOGLE_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const claimsB64 = base64url(JSON.stringify(claims));
  const unsignedToken = `${headerB64}.${claimsB64}`;

  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64urlFromBuffer(new Uint8Array(signature));
  return `${unsignedToken}.${signatureB64}`;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Handle escaped newlines from environment variables
  const normalizedPem = pem.replace(/\\n/g, "\n");

  const pemContents = normalizedPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryStr = atob(pemContents);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function base64url(str: string): string {
  return base64urlFromBuffer(new TextEncoder().encode(str));
}

function base64urlFromBuffer(buffer: Uint8Array): string {
  let binary = "";
  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
