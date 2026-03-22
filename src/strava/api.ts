import {
  STRAVA_API_BASE,
  type StravaDetailedActivity,
  type RateLimitInfo,
} from "../config";
import { withRetry, checkResponseRetryable } from "../utils/retry";

export async function getActivity(
  accessToken: string,
  activityId: number
): Promise<StravaDetailedActivity> {
  return withRetry(async () => {
    const response = await fetch(
      `${STRAVA_API_BASE}/activities/${activityId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    checkResponseRetryable(response);

    if (!response.ok) {
      throw new Error(
        `Strava API error ${response.status} fetching activity ${activityId}`
      );
    }

    return response.json();
  });
}

export async function listActivities(
  accessToken: string,
  params: {
    page?: number;
    per_page?: number;
    before?: number;
    after?: number;
  } = {}
): Promise<{ activities: StravaDetailedActivity[]; rateLimit: RateLimitInfo }> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.per_page) query.set("per_page", String(params.per_page));
  if (params.before) query.set("before", String(params.before));
  if (params.after) query.set("after", String(params.after));

  const response = await fetch(
    `${STRAVA_API_BASE}/athlete/activities?${query}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  checkResponseRetryable(response);

  if (!response.ok) {
    throw new Error(`Strava API error ${response.status} listing activities`);
  }

  return {
    activities: await response.json(),
    rateLimit: parseRateLimitHeaders(response),
  };
}

export function parseRateLimitHeaders(response: Response): RateLimitInfo {
  const limitHeader = response.headers.get("X-RateLimit-Limit") || "100,1000";
  const usageHeader = response.headers.get("X-RateLimit-Usage") || "0,0";

  const [fifteenMinLimit, dailyLimit] = limitHeader.split(",").map(Number);
  const [fifteenMinUsage, dailyUsage] = usageHeader.split(",").map(Number);

  return { fifteenMinLimit, fifteenMinUsage, dailyLimit, dailyUsage };
}
