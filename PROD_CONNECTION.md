# Connecting the Command Center to Prod (read-only)

## It is wired – how to open it with real data

1. Copy the `web/` folder and `live_export.py` into the **Sam & AT** folder on the Mac, next to `dashboard.py`
   (the updated `dashboard.py` already contains the `/cc/` route and the sidebar link).
2. Double-click `Open_Dashboard.command` as usual.
3. Click **✦ Command Center** in the bot's sidebar, or open `http://127.0.0.1:8765/cc/`.

The top bar shows **Live · read-only · <time>**. Every time the page loads, `dashboard.py` builds the data fresh from the
latest result folders with its own readers (`bu_health`, `all_findings`, `history`, `freshness`), so the Command Center
always matches the bot's Findings page, including Done-list closures and the "held back – data incomplete" gate.

What maps to what:

| Bot result | Command Center |
|---|---|
| Each BU / check folder (`results/<BU>/…`) | Market and check cards, folders, solar-system planets, market panels |
| Findings rows with status NEW / DOUBT | Records with status **Open** |
| Findings rows with status KNOWN | Records with status **Known** |
| INFO / CLOSED rows | Not listed (same as the bot's default view) |
| Check name | Root-cause code when a playbook exists (no contact, stuck escrow, tier, return > sale, voucher definition), otherwise the check's own name |
| Problem / SuggestedFix columns | "What is wrong" / "Suggested fix" in the record panel |
| Freshness | "Stale data" tile |

Limits: the newest 4,000 NEW/DOUBT/KNOWN rows are sent (the rest are counted in `truncated`); Marketing Cloud journey
pages stay empty until you add `results/Journeys/journeys_latest.json` (see below).

Protection: `/cc/` and `/cc/data/live.js` answer only on 127.0.0.1 and only with the private key cookie (403 otherwise);
only `.html/.js/.css/.md` files inside `web/` are served; `../` and encoded tricks return 404; test datasets are never served.
If the export fails for any reason, the page falls back to demo data with an amber **Demo data** badge instead of breaking.

`python3 live_export.py` writes a one-off `web/data/live.js` (mode 600) if you want to look at the data without the server.
Never commit that file: the GitHub copy of `data/live.js` must stay `null`.

The dashboard never talks to Salesforce or Marketing Cloud itself. It only reads one file, `data/live.js`.
Your local bot (`daily_bot.py` / `dashboard.py`) builds that file from its own **read-only** exports.

```
SFLM Prod ──(SELECT / bulk export only)──▶ daily_bot.py ──▶ results/*.csv ──▶ build live.js ──▶ dashboard
```

- `data/live.js` empty (`window.SAMAT_LIVE = null`) → the dashboard shows **Demo data** (amber badge in the top bar).
- `data/live.js` filled → it shows **Live · read-only** (green badge). All demo-only behaviour is switched off on live data:
  no simulated "new failure" pop-ups and no demo notifications.

## Safety rules (unchanged from the bot)

1. Only `sf data query` / `sf data export bulk` with `SELECT`. The bot's extra list already refuses anything else.
2. The dashboard has no button that writes to Prod. "Exclude at-risk members" only builds a list for you.
3. Nothing is sent to Marketing Cloud and no journey, flow or batch is started from the dashboard.
4. Keep `live.js` on the Mac (127.0.0.1). Do **not** commit a real `live.js` to the public GitHub repo; it would expose member IDs.
   The repo's `data/live.js` must stay `null`.

## The file shape

```js
window.SAMAT_LIVE = {
  generatedAt: "16 Nov 07:05 IST",            // shown in the badge
  bus:      [ { k:"SG 5010", m:"SAM Singapore", st:"bad|ok", n:1, kn:0, i:0, c:0, f:4, t:"07:57", tr:[0,0,1,0,0,0,1] } ],
  journeys: [ { id:"J1", n:"TH Black Birthday voucher", bu:"TH 5640", p:"SAM|AT|TUMI",
                k:"birthday|welcome|tier|expiry|reactivate", st:"bad|warn|ok|none",
                in:1240, fs:3 /* index of the failing step, -1 = none */, err:{ E_NO_CONTACT:41 },
                streak:3, own:"TH CRM", notrun:"optional reason" } ],
  records:  [ { id:"SSTH2025…", name:"…", bu:"TH 5640", j:"J1", jn:"TH Black Birthday voucher",
                step:"Email", code:"E_NO_CONTACT", tier:"Black", ts:"16 Nov 06:31", tsn:391 /* minutes of day */,
                st:"Open|Retried OK|Suppressed", src:"Journey|Daily check", sev:"bad|warn|info" } ],
  schedule: [ ["J1","18:00"] ],                 // journey id + local start time, for Pre-flight and Schedule
  history:  { E_NO_CONTACT:[ { d:"9 Nov", t:"06:42", j:"J1", jn:"…", bu:"TH 5640", recs:36,
                ids:["SSTH…","SSTH…","SSTH…"], fix:"…", mttr:"3h 10m", held:2 } ] },
  // optional – fall back to demo if omitted:
  kpis:[], attention:[], watch:[], campaigns:[], todo:[], pulse:[], notifications:[]
};
```

Error codes the root-cause engine knows: `E_NO_CONTACT`, `E_VDEF_EXPIRED`, `E_MEMBER_INACTIVE`, `E_DPE_NO_JOURNAL`,
`E_TIER_CHANGED`, `E_TIMEOUT`, `E_CONSENT`, plus the daily-check codes `ESCROW_STUCK`, `TIER_PENDING`, `TIER_DOWNGRADE`,
`RETURN_GT_SALE`, `ESCROW_AT_EXPIRY`. An unknown code still shows (as its raw code) – it just has no playbook yet.

## Read-only queries each feature needs

| Feature | Source (all SELECT) |
|---|---|
| Market tiles, tier split | `LoyaltyProgramMember`, `LoyaltyMemberTier` (already exported by the BU checks) |
| Batches / Schedule | `SELECT BatchJobDefinitionName, Status, StartTime, EndTime FROM BatchJob WHERE CreatedDate = TODAY` |
| No-contact / E_NO_CONTACT | `SELECT Id, MembershipNumber, Contact.Email FROM LoyaltyProgramMember WHERE Contact.Email = null AND MemberStatus = 'Active'` |
| Voucher definition expiry | `SELECT Id, Name, ExpirationDate, IsActive FROM VoucherDefinition WHERE ExpirationDate <= NEXT_N_DAYS:30` |
| Escrow / returns / dup / negative balance | existing bot outputs in `results/<BU>/` |
| Journey step counts + send errors | Marketing Cloud journey / send logs exported to a CSV (read access only) |

## Check a file before using it

```
python3 validate_live.py data/live.js
```

It refuses a file that has the wrong shape, unknown statuses, records pointing to missing journeys, or anything that is
not plain data (no functions, no script). Exit code 0 = safe to load.

## Test pages

`data/test/empty.js` (no data at all) and `data/test/small.js` (2 journeys, 3 records) were used to prove every page,
panel, report and chart works with empty or partial data – no errors, and no `NaN` / `Infinity` / `undefined` on screen.
