import type { Context } from "hono";
import type { Bindings, StravaWebhookEvent } from "../config";
import { getValidAccessToken } from "./auth";
import { getActivity } from "./api";
import { getGoogleAccessToken } from "../sheets/auth";
import { upsertActivity, markActivityDeleted } from "../sheets/client";

export function handleWebhookValidation(c: Context<{ Bindings: Bindings }>) {
  const mode = c.req.query("hub.mode");
  const challenge = c.req.query("hub.challenge");
  const verifyToken = c.req.query("hub.verify_token");

  if (mode === "subscribe" && verifyToken === c.env.STRAVA_VERIFY_TOKEN) {
    console.log("Webhook subscription validated");
    return c.json({ "hub.challenge": challenge });
  }

  return c.text("Forbidden", 403);
}

export async function handleWebhookEvent(
  c: Context<{ Bindings: Bindings }>
): Promise<Response> {
  const event: StravaWebhookEvent = await c.req.json();

  // Respond immediately — Strava expects 200 within 2 seconds
  c.executionCtx.waitUntil(processWebhookEvent(c.env, event));

  return c.json({ received: true });
}

async function processWebhookEvent(
  env: Bindings,
  event: StravaWebhookEvent
): Promise<void> {
  try {
    // Ignore non-activity events
    if (event.object_type !== "activity") {
      console.log(`Ignoring ${event.object_type} event`);
      return;
    }

    // Validate owner
    if (String(event.owner_id) !== env.STRAVA_ATHLETE_ID) {
      console.log(`Ignoring event for athlete ${event.owner_id}`);
      return;
    }

    console.log(
      `Processing ${event.aspect_type} event for activity ${event.object_id}`
    );

    const googleToken = await getGoogleAccessToken(
      env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      env.GOOGLE_PRIVATE_KEY
    );

    const sheetsCtx = {
      accessToken: googleToken,
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      sheetName: env.GOOGLE_SHEET_NAME,
    };

    if (event.aspect_type === "delete") {
      await markActivityDeleted(sheetsCtx, event.object_id);
      console.log(`Marked activity ${event.object_id} as deleted`);
      return;
    }

    // create or update: fetch full activity details
    const stravaToken = await getValidAccessToken(
      env.STRAVA_KV,
      env.STRAVA_CLIENT_ID,
      env.STRAVA_CLIENT_SECRET
    );

    const activity = await getActivity(stravaToken, event.object_id);
    const result = await upsertActivity(sheetsCtx, activity);
    console.log(`Activity ${event.object_id} ${result}`);
  } catch (error) {
    console.error(
      `Error processing webhook event for activity ${event.object_id}:`,
      error
    );
  }
}
