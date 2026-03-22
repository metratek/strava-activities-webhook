import { Hono } from "hono";
import type { Bindings } from "./config";
import {
  getAuthRedirectUrl,
  exchangeCodeForTokens,
  storeTokens,
} from "./strava/auth";
import {
  handleWebhookValidation,
  handleWebhookEvent,
} from "./strava/webhook";
import { runBackfill } from "./backfill";

const app = new Hono<{ Bindings: Bindings }>();

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Strava webhook — subscription validation
app.get("/webhook", (c) => {
  return handleWebhookValidation(c);
});

// Strava webhook — event receiver
app.post("/webhook", async (c) => {
  return handleWebhookEvent(c);
});

// Strava OAuth — initiate authorization
app.get("/auth", (c) => {
  const callbackUrl = new URL("/auth/callback", c.req.url).toString();
  const redirectUrl = getAuthRedirectUrl(c.env.STRAVA_CLIENT_ID, callbackUrl);
  return c.redirect(redirectUrl);
});

// Strava OAuth — handle callback
app.get("/auth/callback", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");

  if (error) {
    return c.text(`OAuth error: ${error}`, 400);
  }

  if (!code) {
    return c.text("Missing authorization code", 400);
  }

  const tokens = await exchangeCodeForTokens(
    code,
    c.env.STRAVA_CLIENT_ID,
    c.env.STRAVA_CLIENT_SECRET
  );

  await storeTokens(c.env.STRAVA_KV, tokens);

  return c.json({
    success: true,
    message: "Strava authorization complete. Tokens stored.",
    athlete_id: tokens.athlete?.id,
  });
});

// Historical backfill — protected endpoint
app.get("/backfill", async (c) => {
  const secret = c.req.query("secret");
  if (secret !== c.env.BACKFILL_SECRET) {
    return c.text("Unauthorized", 401);
  }

  const before = c.req.query("before");
  const after = c.req.query("after");
  const max = c.req.query("max");

  const result = await runBackfill(c.env, {
    before: before ? parseInt(before, 10) : undefined,
    after: after ? parseInt(after, 10) : undefined,
    maxActivities: max ? parseInt(max, 10) : 30,
  });

  return c.json(result);
});

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: err.message }, 500);
});

export default app;
