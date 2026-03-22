import type { Bindings } from "./config";
import { getValidAccessToken } from "./strava/auth";
import { getActivity, listActivities } from "./strava/api";
import { getGoogleAccessToken } from "./sheets/auth";
import { upsertActivity, ensureHeaders } from "./sheets/client";

interface BackfillResult {
  total: number;
  created: number;
  updated: number;
  errors: number;
  rateLimitPaused: boolean;
}

export async function runBackfill(
  env: Bindings,
  options: { before?: number; after?: number; maxActivities?: number } = {}
): Promise<BackfillResult> {
  const { maxActivities = 30 } = options;

  const stravaToken = await getValidAccessToken(
    env.STRAVA_KV,
    env.STRAVA_CLIENT_ID,
    env.STRAVA_CLIENT_SECRET
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

  await ensureHeaders(sheetsCtx);

  const result: BackfillResult = {
    total: 0,
    created: 0,
    updated: 0,
    errors: 0,
    rateLimitPaused: false,
  };

  let page = 1;
  const perPage = 30;

  while (result.total < maxActivities) {
    const { activities, rateLimit } = await listActivities(stravaToken, {
      page,
      per_page: perPage,
      before: options.before,
      after: options.after,
    });

    if (activities.length === 0) break;

    // Check rate limit — pause if approaching 15-min limit
    if (rateLimit.fifteenMinUsage > rateLimit.fifteenMinLimit * 0.8) {
      console.log("Approaching rate limit, stopping batch");
      result.rateLimitPaused = true;
      break;
    }

    for (const summary of activities) {
      if (result.total >= maxActivities) break;

      try {
        // List endpoint returns summaries — fetch full details
        const fullActivity = await getActivity(stravaToken, summary.id);
        const action = await upsertActivity(sheetsCtx, fullActivity);

        if (action === "created") result.created++;
        else result.updated++;

        result.total++;
        console.log(
          `Backfill: ${action} activity ${summary.id} (${result.total}/${maxActivities})`
        );
      } catch (error) {
        console.error(`Backfill error for activity ${summary.id}:`, error);
        result.errors++;
        result.total++;
      }
    }

    page++;
  }

  return result;
}
