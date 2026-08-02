/* sheets.js
   Shared fetch helper for pulling live data from the Biomedical Innovations
   Project Tracker Google Sheet into static GitHub Pages pages.

   HOW TO SET THIS UP:
   1. Replace SHEET_ID below with your real Sheet ID (Step 2, Part A).
   2. Replace the three GID placeholders below with your real gids (Step 2, Part B).
   3. Confirm Sheet is "Anyone with the link: Viewer" (Share) AND Published to web.
*/

// ── TODO: fill these in from Step 2 ──────────────────────────────
const SHEET_ID = "14rtBS-Okk7DWrroNznYtepigcF7cCpwGLtwhNT5n0Hs";

const GIDS = {
  dashboard: "1643196814",
  roster: "572784313",
  presentations: "2069434519",
  syllabus: "1905738931",
  updateLog: "1731368813",
};

// Some tabs have header cells containing extra baked-in guidance text
// (e.g. "Presentation Type\nMilestone deliverable\nMid-Semester Check-In\nSymposium"
// all in one cell), which breaks reading the header as a clean column name.
// For any tab where that happens, list its real column names here in order —
// fetchTab will use these instead of whatever the sheet's header cells contain.
const HEADER_OVERRIDES = {
  [GIDS.presentations]: ["Project", "Presentation Type", "Date", "Prep Status", "Owner", "Key (calc)"],
};
// ──────────────────────────────────────────────────────────────────

/**
 * Parse a gviz date cell value, which comes back as a literal string
 * like "Date(2026,8,14)" (month is 0-indexed), into a readable string
 * like "Sep 14, 2026". Returns "" if the value isn't a gviz date.
 */
function formatGvizDate(value) {
  if (!value || typeof value !== "string" || !value.startsWith("Date(")) {
    return value || "";
  }
  const nums = value.slice(5, -1).split(",").map(n => parseInt(n, 10));
  const [y, m, d] = nums;
  const dt = new Date(y, m, d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Fetch a single tab from the published Google Sheet and return it as
 * an array of row objects keyed by header name.
 *
 * NOTE: this assumes the tab's FIRST ROW is the header row (confirmed
 * necessary after testing — gviz did not auto-detect headers on this
 * sheet, so we pull headers from rows[0] ourselves rather than cols[]).
 *
 * @param {string} gid - the tab's gid (use GIDS.dashboard, GIDS.roster, etc.)
 * @returns {Promise<Array<Object>>}
 */
async function fetchTab(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error("Network error fetching sheet tab:", gid, err);
    return [];
  }

  if (!res.ok) {
    console.error("Sheet fetch failed:", res.status, gid);
    return [];
  }

  const text = await res.text();

  let json;
  try {
    // gviz wraps its JSON in a JS callback string — strip the wrapper.
    json = JSON.parse(text.substring(47).slice(0, -2));
  } catch (err) {
    console.error("Could not parse gviz response for gid", gid, err);
    return [];
  }

  if (json.status === "error") {
    console.error("gviz returned an error for gid", gid, json.errors);
    return [];
  }

  const table = json.table;
  let headers, dataRows;

  if (table.parsedNumHeaders && table.parsedNumHeaders > 0) {
    // gviz auto-detected a real header row on this tab (e.g. bold/frozen
    // formatting) — cols[].label is already correct, and table.rows is
    // pure data with no header row mixed in.
    headers = table.cols.map(c => c.label || "");
    dataRows = table.rows || [];
  } else {
    // No auto-detected header on this tab (plain-text header row) — fall
    // back to treating the first row ourselves as the header row.
    if (!table.rows || table.rows.length < 2) return [];
    headers = table.rows[0].c.map(cell => (cell ? cell.v : "") || "");
    dataRows = table.rows.slice(1);
  }

  // Override with known-clean header names if this tab's header cells
  // contain extra baked-in text (see HEADER_OVERRIDES above).
  if (HEADER_OVERRIDES[gid] && HEADER_OVERRIDES[gid].length === headers.length) {
    headers = HEADER_OVERRIDES[gid];
  }

  return dataRows
    // Drop the "^ example row" placeholder, fully-empty rows, and any
    // note/instruction rows. Real data rows have more than just column A
    // filled in — instruction rows (e.g. "This tab is fully computed...")
    // only populate column A, so require at least one other column to
    // have a value too.
    .filter(r => {
      const first = r.c[0] && r.c[0].v != null ? String(r.c[0].v).trim() : "";
      if (!first || first.startsWith("^")) return false;
      const hasOtherData = r.c.slice(1).some(cell => cell && cell.v != null && String(cell.v).trim() !== "");
      return hasOtherData;
    })
    .map(r =>
      Object.fromEntries(
        r.c.map((cell, i) => [headers[i], cell ? cell.v : null])
      )
    );
}

/**
 * Convenience: fetch all five tabs together.
 * @returns {Promise<{dashboard: Array, roster: Array, presentations: Array, syllabus: Array, updateLog: Array}>}
 */
async function fetchAllTabs() {
  const [dashboard, roster, presentations, syllabus, updateLog] = await Promise.all([
    fetchTab(GIDS.dashboard),
    fetchTab(GIDS.roster),
    fetchTab(GIDS.presentations),
    fetchTab(GIDS.syllabus),
    fetchTab(GIDS.updateLog),
  ]);
  return { dashboard, roster, presentations, syllabus, updateLog };
}
