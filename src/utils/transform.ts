import type { StravaDetailedActivity } from "../config";

export type SheetRow = (string | number | boolean | null)[];

export function activityToRow(activity: StravaDetailedActivity): SheetRow {
  return [
    activity.id,
    activity.start_date,
    activity.name,
    activity.sport_type,
    activity.distance,
    activity.moving_time,
    activity.elapsed_time,
    activity.total_elevation_gain,
    activity.average_heartrate ?? null,
    activity.max_heartrate ?? null,
    activity.average_watts ?? null,
    activity.weighted_average_watts ?? null,
    activity.average_cadence ?? null,
    activity.kudos_count,
    activity.trainer,
    activity.commute,
    activity.manual,
    new Date().toISOString(),
    "synced",
  ];
}
