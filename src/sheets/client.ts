import {
  GOOGLE_SHEETS_BASE,
  SHEET_COLUMNS,
  type SheetsContext,
  type StravaDetailedActivity,
} from "../config";
import { activityToRow } from "../utils/transform";

export async function getSheetData(
  ctx: SheetsContext,
  range: string
): Promise<string[][]> {
  const url = `${GOOGLE_SHEETS_BASE}/${ctx.spreadsheetId}/values/${encodeURIComponent(ctx.sheetName)}!${range}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${ctx.accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets API error (${response.status}): ${text}`);
  }

  const data: { values?: string[][] } = await response.json();
  return data.values || [];
}

export async function findRowByActivityId(
  ctx: SheetsContext,
  activityId: number
): Promise<{ rowIndex: number; rowData: string[] } | null> {
  const values = await getSheetData(ctx, "A:A");
  const idStr = String(activityId);

  for (let i = 1; i < values.length; i++) {
    if (values[i]?.[0] === idStr) {
      return { rowIndex: i + 1, rowData: values[i] }; // 1-based row index
    }
  }

  return null;
}

export async function appendRow(
  ctx: SheetsContext,
  values: (string | number | boolean | null)[]
): Promise<void> {
  const range = `${ctx.sheetName}!A:S`;
  const url = `${GOOGLE_SHEETS_BASE}/${ctx.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [values] }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets append failed (${response.status}): ${text}`);
  }
}

export async function updateRow(
  ctx: SheetsContext,
  rowIndex: number,
  values: (string | number | boolean | null)[]
): Promise<void> {
  const range = `${ctx.sheetName}!A${rowIndex}:S${rowIndex}`;
  const url = `${GOOGLE_SHEETS_BASE}/${ctx.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [values] }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets update failed (${response.status}): ${text}`);
  }
}

export async function upsertActivity(
  ctx: SheetsContext,
  activity: StravaDetailedActivity
): Promise<"created" | "updated"> {
  const existing = await findRowByActivityId(ctx, activity.id);
  const row = activityToRow(activity);

  if (existing) {
    await updateRow(ctx, existing.rowIndex, row);
    return "updated";
  } else {
    await appendRow(ctx, row);
    return "created";
  }
}

export async function markActivityDeleted(
  ctx: SheetsContext,
  activityId: number
): Promise<void> {
  const existing = await findRowByActivityId(ctx, activityId);
  if (!existing) return;

  // Update last_synced_at (column R, index 18) and sync_status (column S, index 19)
  const range = `${ctx.sheetName}!R${existing.rowIndex}:S${existing.rowIndex}`;
  const url = `${GOOGLE_SHEETS_BASE}/${ctx.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: [[new Date().toISOString(), "deleted"]],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Sheets mark-deleted failed (${response.status}): ${text}`
    );
  }
}

export async function ensureHeaders(ctx: SheetsContext): Promise<void> {
  const values = await getSheetData(ctx, "A1:S1");

  if (values.length > 0 && values[0].length > 0) return; // headers exist

  const range = `${ctx.sheetName}!A1:S1`;
  const url = `${GOOGLE_SHEETS_BASE}/${ctx.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [[...SHEET_COLUMNS]] }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Sheets write headers failed (${response.status}): ${text}`
    );
  }
}
