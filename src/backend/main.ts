// Bundle entry for Apps Script. gas/wrappers.js exposes these as the
// global functions Apps Script calls (doPost, setup, …).
import { handleRequest, type ApiResponse } from "./api";
import { GasStore } from "./gasStore";
import { setupSpreadsheet } from "./setup";
import { migrate } from "./migrationRunner";
import { runRecurringCharges } from "./recurring";
import { todayTaipei } from "../shared/dates";

const OLD_SHEET_ID = "1QB2MOJrNueV3q0d5dXNGaJeT7T5a0eJWGQlox2MbSW0";
const props = () => PropertiesService.getScriptProperties();
const newId = () => Utilities.getUuid();

function openTarget(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const id = props().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("SPREADSHEET_ID is not set. Run createSheets first.");
  return SpreadsheetApp.openById(id);
}

function json(res: ApiResponse) {
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

export function doGet() {
  return json({ ok: true, data: "Plate API" });
}

export function doPost(e: GoogleAppsScript.Events.DoPost) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return json(
      handleRequest(e?.postData?.contents ?? "", {
        store: new GasStore(openTarget()),
        token: props().getProperty("API_TOKEN") ?? "",
        now: new Date(),
        newId,
      }),
    );
  } catch (err) {
    return json({ ok: false, error: { code: "SERVER", message: String(err instanceof Error ? err.message : err) } });
  } finally {
    lock.releaseLock();
  }
}

/** One-time: makes the two Sheets in the owner's Drive and points the API at TEST. */
export function createSheets() {
  const p = props();
  if (p.getProperty("TEST_SPREADSHEET_ID")) {
    Logger.log("Sheets already exist. TEST: %s", p.getProperty("TEST_SPREADSHEET_ID"));
    return;
  }
  const test = SpreadsheetApp.create("Plate TEST");
  const real = SpreadsheetApp.create("Plate");
  p.setProperties({
    TEST_SPREADSHEET_ID: test.getId(),
    REAL_SPREADSHEET_ID: real.getId(),
    SPREADSHEET_ID: test.getId(),
    OLD_SPREADSHEET_ID: OLD_SHEET_ID,
  });
  Logger.log("Created Plate TEST: %s", test.getUrl());
  Logger.log("Created Plate: %s", real.getUrl());
}

export function setup() {
  const ss = openTarget();
  setupSpreadsheet(ss, newId);
  ensureDailyRecurringTrigger();
  Logger.log("Set up %s (%s)", ss.getName(), ss.getUrl());
}

/** Exactly one trigger: runRecurring every day around midnight (the project's timezone is Asia/Taipei). */
function ensureDailyRecurringTrigger() {
  const exists = ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === "runRecurring");
  if (exists) return;
  ScriptApp.newTrigger("runRecurring").timeBased().everyDays(1).atHour(0).create();
  Logger.log("Added a daily trigger for runRecurring");
}

export function generateToken() {
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
  props().setProperty("API_TOKEN", token);
  Logger.log("Your app token (paste it into Plate > Settings): %s", token);
}

export function runMigration() {
  const oldId = props().getProperty("OLD_SPREADSHEET_ID") ?? OLD_SHEET_ID;
  migrate(openTarget(), oldId, new Date(), newId);
}

/** Daily trigger (set up by setup()): adds the recurring charges due today. */
export function runRecurring() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const added = runRecurringCharges(new GasStore(openTarget()), todayTaipei(), new Date());
    Logger.log("Recurring: added %s charge(s)", added);
  } finally {
    lock.releaseLock();
  }
}

export function useRealSheet() {
  const real = props().getProperty("REAL_SPREADSHEET_ID");
  if (!real) throw new Error("Run createSheets first.");
  props().setProperty("SPREADSHEET_ID", real);
  setup();
}
