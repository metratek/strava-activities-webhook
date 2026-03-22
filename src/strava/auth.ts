import {
  STRAVA_OAUTH_URL,
  STRAVA_TOKEN_URL,
  KV_KEYS,
  type StravaTokenResponse,
} from "../config";

export function getAuthRedirectUrl(
  clientId: string,
  callbackUrl: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "activity:read_all",
    approval_prompt: "auto",
  });
  return `${STRAVA_OAUTH_URL}?${params}`;
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<StravaTokenResponse> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  return response.json();
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<StravaTokenResponse> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  return response.json();
}

export async function storeTokens(
  kv: KVNamespace,
  tokens: StravaTokenResponse
): Promise<void> {
  await Promise.all([
    kv.put(KV_KEYS.ACCESS_TOKEN, tokens.access_token),
    kv.put(KV_KEYS.REFRESH_TOKEN, tokens.refresh_token),
    kv.put(KV_KEYS.EXPIRES_AT, String(tokens.expires_at)),
  ]);
}

export async function getValidAccessToken(
  kv: KVNamespace,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const [accessToken, refreshToken, expiresAtStr] = await Promise.all([
    kv.get(KV_KEYS.ACCESS_TOKEN),
    kv.get(KV_KEYS.REFRESH_TOKEN),
    kv.get(KV_KEYS.EXPIRES_AT),
  ]);

  if (!accessToken || !refreshToken || !expiresAtStr) {
    throw new Error(
      "No Strava tokens found in KV. Complete OAuth flow at /auth first."
    );
  }

  const expiresAt = parseInt(expiresAtStr, 10);
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Refresh 5 minutes early to avoid edge cases
  if (nowSeconds >= expiresAt - 300) {
    const newTokens = await refreshAccessToken(
      refreshToken,
      clientId,
      clientSecret
    );
    await storeTokens(kv, newTokens);
    return newTokens.access_token;
  }

  return accessToken;
}
