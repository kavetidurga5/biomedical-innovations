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
};
// ──────────────────────────────────────────────────────────────────

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

  const allRows = json.table.rows;
  if (!allRows || allRows.length < 2) return []; // no data rows beyond header

  const headers = allRows[0].c.map(cell => (cell ? cell.v : "") || "");
  const dataRows = allRows.slice(1);

  return dataRows
    // Drop the "^ example row — delete before real roster upload" placeholder
    // and any fully-empty rows, so it never renders on the live site.
    .filter(r => r.c[0] && r.c[0].v && !String(r.c[0].v).trim().startsWith("^"))
    .map(r =>
      Object.fromEntries(
        r.c.map((cell, i) => [headers[i], cell ? cell.v : null])
      )
    );
}

/**
 * Convenience: fetch Dashboard, Roster, and Presentation Tracker together.
 * @returns {Promise<{dashboard: Array, roster: Array, presentations: Array}>}
 */
async function fetchAllTabs() {
  const [dashboard, roster, presentations] = await Promise.all([
    fetchTab(GIDS.dashboard),
    fetchTab(GIDS.roster),
    fetchTab(GIDS.presentations),
  ]);
  return { dashboard, roster, presentations };
}
