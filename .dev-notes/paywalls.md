# Paywall Inventory

Audit of every paywall, upgrade CTA, license gate, and trial prompt in the codebase. Use this when stripping paid gates from a personal/fork build.

> **Single biggest unlock:** patch the two getters in `apps/studio/src/store/modules/LicenseModule.ts:61` (`isUltimate` → always `true`) and `:65` (`isCommunity` → always `false`). Roughly 80% of the gates below funnel through these. Remaining 20% need individual handling (date-based expiry, `isUltimateType` DB list, external link CTAs).

---

## 1. Store getters (primary chokepoints)

| File | Line | Symbol | Patch to unlock |
| --- | --- | --- | --- |
| `apps/studio/src/store/modules/LicenseModule.ts` | 47 | `trialLicense` getter | n/a |
| `apps/studio/src/store/modules/LicenseModule.ts` | 50 | `realLicenses` getter | n/a |
| `apps/studio/src/store/modules/LicenseModule.ts` | 61 | `isUltimate` | return `true` |
| `apps/studio/src/store/modules/LicenseModule.ts` | 65 | `isCommunity` | return `false` |
| `apps/studio/src/store/modules/LicenseModule.ts` | 69 | `isTrial` | return `false` |
| `apps/studio/src/store/modules/LicenseModule.ts` | 121 | `CloudClient.getLicense()` validation | bypass / stub |
| `apps/studio/src/store/modules/LicenseModule.ts` | 225 | workspace downgrade on community | remove block |
| `apps/studio/src/store/index.ts` | 281 | root `isCommunity` getter | delegates → fixed via module |
| `apps/studio/src/store/index.ts` | 284 | root `isUltimate` getter | delegates → fixed via module |
| `apps/studio/src/store/index.ts` | 287 | root `isTrial` getter | delegates → fixed via module |

## 2. License logic (date/version expiry)

| File | Line | Symbol | Notes |
| --- | --- | --- | --- |
| `apps/studio/src/lib/license.ts` | 18 | `LicenseStatus` class | `edition`, `isUltimate`, `isCommunity`, `isTrial` |
| `apps/studio/src/common/appdb/models/LicenseKey.ts` | 13 | `keysToStatus()` | edition compute; checks `validUntil`, `supportUntil` |
| `apps/studio/src/common/appdb/models/LicenseKey.ts` | 49 | lifetime detection | no `maxAllowedAppRelease` ⇒ lifetime |
| `apps/studio/src/common/appdb/models/LicenseKey.ts` | 55 | version gate | `isVersionLessThanOrEqual(current, maxAllowed)` |

## 3. DB type gates (Ultimate-only databases)

`apps/studio/src/common/interfaces/IConnection.ts:6` — `isUltimateType()` list:
`oracle, firebird, cassandra, libsql, duckdb, clickhouse, mongodb, sqlanywhere, trino, surrealdb, dynamodb`

Patch: make `isUltimateType()` return `false` (treat all as community).

Form sections gated by this:
- `apps/studio/src/components/ConnectionInterface.vue:97,102,107,112,117,122,127,132,137,142,152` — 11 `v-if="isUltimate"` blocks

## 4. Modals

| File | Purpose |
| --- | --- |
| `apps/studio/src/components/upsell/UpgradeRequiredModal.vue` | Fires on `AppEvent.upgradeModal` |
| `apps/studio/src/components/license/TrialExpiredModal.vue` | 14-day trial expiry |
| `apps/studio/src/components/license/LicenseExpiredModal.vue` | Non-trial license expired |
| `apps/studio/src/components/license/LifetimeLicenseExpiredModal.vue` | Lifetime license support date expired |
| `apps/studio/src/components/ultimate/EnterLicenseModal.vue` | License key entry form |
| `apps/studio/src/components/common/modals/DriverDepLicenseModal.vue` | Driver dependency license accept |

## 5. Upsell panels / buttons

| File | Purpose |
| --- | --- |
| `apps/studio/src/components/upsell/UpgradePanel.vue` | Generic unlock CTA → beekeeperstudio.io/upgrade |
| `apps/studio/src/components/upsell/JsonViewerSidebarUpsell.vue` | JSON row viewer lock |
| `apps/studio/src/components/upsell/AiShellUpsell.vue` | AI Shell upsell + lifetime pitch |
| `apps/studio/src/components/upsell/common/UpsellButtons.vue` | Trial start / upgrade / learn-more buttons |

## 6. Tab-level locks (`v-if="isCommunity"`)

| File | Line | Feature |
| --- | --- | --- |
| `apps/studio/src/components/TabDatabaseBackup.vue` | 27 | Database backup/restore |
| `apps/studio/src/components/TabImportTable.vue` | 13 | Import from file |
| `apps/studio/src/components/TabPluginBase.vue` | 2 | Bundled `bks-*` plugins |
| `apps/studio/src/components/TabPluginShell.vue` | 3 | AI shell plugin |
| `apps/studio/src/components/CoreTabs.vue` | 63 | Upgrade button in core tabs |

## 7. Inline feature locks

| File | Line(s) | Feature |
| --- | --- | --- |
| `apps/studio/src/components/TabQueryEditor.vue` | 173, 226, 239, 429, 1269, 1420, 1434 | Editable results, query folders, save-to-file |
| `apps/studio/src/components/connection/MysqlForm.vue` | 64 | Enterprise SSH-key auth |
| `apps/studio/src/components/connection/PostgresForm.vue` | 108 | Enterprise SSH-key auth |
| `apps/studio/src/components/connection/SqlServerForm.vue` | 90 | Enterprise SSH-key auth |
| `apps/studio/src/components/sidebar/JsonViewer.vue` | 66 | JSON viewer upsell |
| `apps/studio/src/components/sidebar/ConnectionSidebar.vue` | 552, 582 | Connection folders |
| `apps/studio/src/components/sidebar/WorkspaceSidebar.vue` | 106, 114 | Cloud workspace ops |
| `apps/studio/src/components/connection/SaveConnectionForm.vue` | 18, 19 | Connection folders |
| `apps/studio/src/components/connection/SqliteForm.vue` | 18 | In-memory SQLite |
| `apps/studio/src/components/sidebar/core/FavoriteList.vue` | 31, 404, 434 | Favorite/folder ops nag |
| `apps/studio/src/components/sidebar/core/TableList.vue` | 152 | Table ops nag |
| `apps/studio/src/components/tableview/TableTable.vue` | 252, 1276, 1281 | Quick filter |
| `apps/studio/src/components/tableview/RowFilterBuilder.vue` | 216, 267, 332 | Advanced filter |
| `apps/studio/src/components/quicksearch/QuickSearch.vue` | 259 | Ultimate-DB search restriction |
| `apps/studio/src/components/export/ExportModal.vue` | 327 | Multi-table export |
| `apps/studio/src/components/ConnectionInterface.vue` | 161, 169 | Read-only mode |
| `apps/studio/src/components/ConnectionInterface.vue` | 224, 228 | Community/trial pitch panel |

## 8. AppEvents (event-driven paywall triggers)

| File | Line | Event |
| --- | --- | --- |
| `apps/studio/src/common/AppEvent.ts` | 37 | `enterLicense` |
| `apps/studio/src/common/AppEvent.ts` | 49 | `upgradeModal` |
| `apps/studio/src/common/AppEvent.ts` | 57 | `licenseExpired` |
| `apps/studio/src/common/AppEvent.ts` | 59 | `licenseValidDateExpired` |
| `apps/studio/src/common/AppEvent.ts` | 61 | `licenseSupportDateExpired` |

## 9. Trial mechanics

| File | Line | Notes |
| --- | --- | --- |
| `apps/studio/src/store/modules/LicenseModule.ts` | 107 | `createTrialLicense` dispatch |
| `apps/studio/src/store/modules/LicenseModule.ts` | 110 | 14-day message |
| `apps/studio/src/App.vue` | 200 | Trial expiry noty (`isTrial && isUltimate`) |
| `apps/studio/src/components/upsell/common/UpsellButtons.vue` | 76 | Trial only if `noLicensesFound` |

## 10. External links (pricing/upgrade)

| File | Line | URL |
| --- | --- | --- |
| `apps/studio/src/components/upsell/UpgradePanel.vue` | 93 | `https://www.beekeeperstudio.io/upgrade` |
| `apps/studio/src/components/upsell/common/UpsellButtons.vue` | 64, 65 | `/upgrade`, `/pricing` |
| `apps/studio/src/components/ultimate/EnterLicenseModal.vue` | 47 | `/pricing` |
| `apps/studio/src/components/ConnectionInterface.vue` | 226, 231 | upgrade links |
| `apps/studio/src/components/NotificationManager.vue` | 25 | `/pricing/` |
| `apps/studio/src/App.vue` | 212 | `/pricing` |

## 11. Notification copy

| File | Line | Copy |
| --- | --- | --- |
| `apps/studio/src/components/upsell/UpgradePanel.vue` | 13, 27 | "Unlock X", "What you unlock by upgrading" |
| `apps/studio/src/components/upsell/UpgradePanel.vue` | 78 | "Lifetime license - included as part of every subscription" |
| `apps/studio/src/components/upsell/AiShellUpsell.vue` | 13 | "Upgrade required" |
| `apps/studio/src/components/ultimate/EnterLicenseModal.vue` | 21 | "premium features such as Oracle, DuckDB, and ClickHouse connections" |
| `apps/studio/src/components/NotificationManager.vue` | 17 | "Upgrade for features like the JSON row viewer, AI shell, & NoSQL support…" |

---

## Totals

- ~68 monetization touchpoints
- 11 gated DB types
- 5 AppEvents
- 6 modals, 4 upsell panels, 5 tab locks
- `apps/ui-kit/` — clean, no paywalls

## Suggested removal order

1. Patch `LicenseModule.ts` getters (`isUltimate=true`, `isCommunity=false`, `isTrial=false`).
2. Patch `IConnection.ts:isUltimateType()` → return `false`.
3. Stub `CloudClient.getLicense()` validation in `LicenseModule.ts:121`.
4. Disable date/version expiry in `LicenseKey.ts:13` (`keysToStatus`).
5. Disable trial expiry noty in `App.vue:200`.
6. (Cosmetic) hide upsell panels/modals/external links.

---

## Removal Log

### 2026-05-27 — decorative panels/buttons stripped

Removed all pure-CTA panels/buttons (no feature behind them — vanish on upgrade with nothing unlocked).

**Files deleted:**
- `apps/studio/src/components/upsell/UpgradePanel.vue` — generic "Unlock X" pitch panel
- `apps/studio/src/components/upsell/UpgradeRequiredModal.vue` — `AppEvent.upgradeModal` listener modal (only wrapped `UpgradePanel`)

**Files edited (UpgradePanel import + `v-if="isCommunity"` upsell block removed):**
- `apps/studio/src/components/TabDatabaseBackup.vue` — also dropped now-unused `isCommunity` mapGetter
- `apps/studio/src/components/TabImportTable.vue` — also dropped now-unused `isCommunity` mapGetter
- `apps/studio/src/components/TabPluginBase.vue` — also dropped `mapGetters(["isCommunity"])` computed
- `apps/studio/src/components/TabPluginShell.vue` — kept `AiShellUpsell` branch (real feature behind it); simplified template to only short-circuit for AI shell plugin
- `apps/studio/src/components/importexportdatabase/ImportExportDatabase.vue` — also dropped now-unused `isCommunity` mapGetter

**`ConnectionInterface.vue`:**
- Removed `<upgrade-panel v-if="shouldUpsell" …>` block (lines ~217–222)
- Removed `<template v-if="!config.connectionType">` pitch block (lines ~223–237) — community/trial/AI-shell pitch with pricing links
- Removed `UpgradePanel` import + components registration
- `shouldUpsell` computed kept (still gates form-section visibility for ultimate-type DBs — real feature gate, not decorative)
- `friendlyConnectionType` computed now unused but left in place (out of scope)

**`CoreTabs.vue`:**
- Removed upgrade button `<a @click="showUpgradeModal" v-if="isCommunity">` (line ~59–66)
- Removed `showUpgradeModal()` method (line ~497)

**`App.vue`:**
- Removed `<upgrade-required-modal />` from template (line 18)
- Removed `UpgradeRequiredModal` import + components registration

**Kept (real features behind paywall):**
- `apps/studio/src/components/upsell/AiShellUpsell.vue` + `AiShellPreview.vue` — replaces real AI shell feature
- `apps/studio/src/components/upsell/JsonViewerSidebarUpsell.vue` — replaces real JSON viewer feature
- `apps/studio/src/components/upsell/common/UpsellButtons.vue` — used by the two upsell screens above

**Dangling but harmless:**
- 15+ `this.$root.$emit(AppEvent.upgradeModal, …)` calls across sidebar/connection forms/RowFilterBuilder/TabQueryEditor/ExportModal still emit; no listener now → silent no-ops
- Menu item `upgradeModal` in `MenuItems.ts:9` / `NativeMenuActionHandlers.ts:205` still wired but emits to nothing
- CSS classes `.upgrade-panel-tab-wrapper`, `.connection-upgrade-panel`, `.pitch`, `.btn-upgrade` now unused
