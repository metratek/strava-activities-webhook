export type Bindings = {
  STRAVA_KV: KVNamespace;
  STRAVA_CLIENT_ID: string;
  STRAVA_CLIENT_SECRET: string;
  STRAVA_VERIFY_TOKEN: string;
  STRAVA_ATHLETE_ID: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
  GOOGLE_SPREADSHEET_ID: string;
  GOOGLE_SHEET_NAME: string;
  BACKFILL_SECRET: string;
};

export const STRAVA_API_BASE = "https://www.strava.com/api/v3";
export const STRAVA_OAUTH_URL = "https://www.strava.com/oauth/authorize";
export const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export const KV_KEYS = {
  ACCESS_TOKEN: "strava_access_token",
  REFRESH_TOKEN: "strava_refresh_token",
  EXPIRES_AT: "strava_expires_at",
} as const;

export const SHEET_COLUMNS = [
  "activity_id",
  "start_date",
  "name",
  "sport_type",
  "distance_m",
  "moving_time_s",
  "elapsed_time_s",
  "total_elevation_gain_m",
  "avg_hr",
  "max_hr",
  "avg_power",
  "weighted_avg_power",
  "avg_cadence",
  "kudos_count",
  "trainer",
  "commute",
  "manual",
  "last_synced_at",
  "sync_status",
] as const;

export interface StravaWebhookEvent {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates?: Record<string, string>;
}

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
  athlete?: { id: number };
}

export interface StravaDetailedActivity {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  average_cadence?: number;
  kudos_count: number;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
}

export interface RateLimitInfo {
  fifteenMinLimit: number;
  fifteenMinUsage: number;
  dailyLimit: number;
  dailyUsage: number;
}

export interface SheetsContext {
  accessToken: string;
  spreadsheetId: string;
  sheetName: string;
}
