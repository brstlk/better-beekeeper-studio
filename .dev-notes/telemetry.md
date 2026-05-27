# Telemetry & External Communication Inventory

Audit of every outbound network call, tracking ID, and update/license phone-home in the codebase. Use this when stripping network calls from a personal/fork build for fully-offline operation.

> **No third-party analytics SDKs.** No Sentry, PostHog, Mixpanel, GA, Bugsnag, Rollbar, Amplitude. No `crashReporter` wiring. The only outbound traffic is to `app.beekeeperstudio.io` (license, update, cloud sync) and Azure (SSO only when used).

---

## 1. Always-on outbound paths

| Purpose | Trigger | Interval | Endpoint | Data sent |
| --- | --- | --- | --- | --- |
| License validation | Paid/trial editions only | every 10 min | `GET https://app.beekeeperstudio.io/api/license_keys/{key}` | `email`, `installationId` (base64 `X-Installation-Id` header), platform info |
| Update check | All editions (unless disabled) | every 24h | electron-updater feed (configured in `electron-builder-config.js`) | electron-updater default metadata |
| Cloud sync | Only after explicit login | on demand | `app.beekeeperstudio.io/api/{connections,queries,workspaces,folders,audits}` | user content (connections, queries, etc.) |
| Azure SSO token | User initiates Azure login | on demand | `app.beekeeperstudio.io/api/cloud_tokens` | OAuth flow metadata |

## 2. Tracking identity

| File | Line | Symbol | Notes |
| --- | --- | --- | --- |
| `apps/studio/src/common/appdb/models/installation_id.ts` | 16 | `installationId` field | UUID, stored locally in app DB |
| `apps/studio/src/migration/20250404_add_installation_id.js` | — | migration | creates `installation_ids` table |
| `apps/studio/src/handlers/licenseHandlers.ts` | 58 | `getInstallationId()` | retrieves UUID for license calls |
| `apps/studio/src/lib/cloud/controllers/LicenseKeyController.ts` | 21 | `get()` | sends `X-Installation-Id` (base64) on license validation |

To make the install untrackable: stub `getInstallationId()` to return a constant/random-per-call UUID, or skip the license call entirely (see §4).

## 3. Hardcoded endpoints / hostnames

| File | Line | Symbol | Value |
| --- | --- | --- | --- |
| `apps/studio/src/common/platform_info/mainPlatformInfo.ts` | 118 | `cloudUrl` | `https://app.beekeeperstudio.io` (prod), `http://localhost:3000` (dev) |
| `apps/studio/src/common/globals.ts` | 28 | `azureCloudTokenUrl` | `app.beekeeperstudio.io/api/cloud_tokens` |
| `apps/studio/src/common/globals.ts` | 4 | `updateCheckInterval` | `1000 * 60 * 60 * 24` (24h) |
| `apps/studio/src/common/globals.ts` | 19 | `licenseCheckInterval` | `1000 * 60 * 10` (10 min) |

Single-point patch: override `cloudUrl` to `http://127.0.0.1:0` (or unroutable) to break all cloud/license/Azure-token calls. Combined with the LicenseModule getter patch in `paywalls.md` (§1), the 10-min license poll stops being mandatory anyway.

## 4. Update check

| File | Line | Symbol | Notes |
| --- | --- | --- | --- |
| `apps/studio/src/background/update_manager.ts` | 36 | `checkForUpdates()` | electron-updater invocation |
| `apps/studio/src/common/globals.ts` | 4 | `updateCheckInterval` | 24h |

**Existing opt-outs (no code change needed):**
- env: `BEEKEEPER_DISABLE_UPDATES=1`
- config: `BksConfig.general.checkForUpdatesDisabled = true`

To hard-disable in a fork: early-return from `checkForUpdates()` or never schedule the interval.

## 5. License poll

| File | Line | Symbol | Notes |
| --- | --- | --- | --- |
| `apps/studio/src/store/modules/LicenseModule.ts` | 204 | `updateAll()` | 10-min periodic sync; 404 → invalidate license |
| `apps/studio/src/lib/cloud/CloudClient.ts` | 67 | `getLicense()` | `GET /api/license_keys/{key}` |
| `apps/studio/src/lib/cloud/CloudClient.ts` | 56 | `login()` | `POST /api/login` |

No env/config opt-out exists. To kill the poll in a fork: either patch the `isCommunity`/`isUltimate` getters per `paywalls.md` (poll only runs for paid/trial), or short-circuit `updateAll()` to return immediately.

## 6. Cloud sync (login-gated)

| File | Line | Symbol | Notes |
| --- | --- | --- | --- |
| `apps/studio/src/lib/cloud/CloudClient.ts` | — | client | sync APIs for connections/queries/workspaces/folders/audits |
| `apps/studio/src/lib/cloud/CloudClient.ts` | — | `/check` | token validation endpoint |

Not invoked unless user explicitly logs into Beekeeper Cloud. Local/community usage = silent.

## 7. Azure SSO

| File | Line | Symbol | Notes |
| --- | --- | --- | --- |
| `apps/studio/src/common/globals.ts` | 28 | `azureCloudTokenUrl` | OAuth token relay endpoint |
| (deps) | — | `@azure/msal-node` | Microsoft auth library |

Polls BKS server during OAuth status check. Only runs if user starts an Azure SSO connection. No background activity.

## 8. Privacy-related settings

| File | Line | Symbol | Effect |
| --- | --- | --- | --- |
| `apps/studio/src/migration/20250618_add_privacy_mode_setting.js` | — | `privacyMode` | masks local credentials/paths in UI only; **does not block network** |

There is no telemetry opt-out toggle because there is no telemetry to opt out of.

---

## TL;DR for a fully-offline fork

1. Patch LicenseModule getters per `paywalls.md` §1 → license poll becomes a no-op (only runs for non-community editions).
2. Set `BEEKEEPER_DISABLE_UPDATES=1` or `BksConfig.general.checkForUpdatesDisabled = true` → kills update check.
3. (Optional belt-and-braces) Override `cloudUrl` in `mainPlatformInfo.ts:118` to an unroutable address → guarantees zero outbound to BKS even if a code path is missed.
4. Azure SSO and cloud sync are user-initiated only — no action needed unless removing the features entirely.

No SDKs to rip out. No analytics endpoints. Network surface is small and well-contained.

---

## Applied stubs (this fork)

License validation has been stubbed out in-tree. The original inventory above still describes the upstream surface; this section records what is *already neutralized* on this branch.

| File | Line | Change | Effect |
| --- | --- | --- | --- |
| `apps/studio/src/common/appdb/models/LicenseKey.ts` | 111 | `getLicenseStatus()` returns synthetic `{ edition: "ultimate", condition: ["Stubbed ultimate"] }` | App reports ultimate edition regardless of DB contents or version checks. `keysToStatus()` left intact (still exported for tests). |
| `apps/studio/src/lib/cloud/CloudClient.ts` | 64 | `getLicense()` returns stub `PersonalLicense` with `validUntil` / `supportUntil` set to `new Date(8640000000000000)` (max date) and `maxAllowedAppRelease: null` | Add/update license flows no longer hit `app.beekeeperstudio.io/api/license_keys/*`. Synthetic license satisfies downstream save logic. |
| `apps/studio/src/store/modules/LicenseModule.ts` | 204 | `updateAll()` reduced to `await context.dispatch('sync')` | 10-min interval from `App.vue` still fires but performs no network I/O. `update()` is no longer called from the periodic path. |

**What this kills:**
- `X-Installation-Id` header transmission (no license endpoint is hit).
- Periodic 10-min license server poll.
- Server-driven license invalidation (404 → `invalidatedAt`) path.

**What still phones home (not addressed by this stub):**
- Auto-update check (electron-updater, 24h). Disable via `BEEKEEPER_DISABLE_UPDATES=1` or `BksConfig.general.checkForUpdatesDisabled`.
- Cloud sync APIs (`/api/connections`, `/api/queries`, etc.). User-initiated only — no background activity unless the user logs into Beekeeper Cloud.
- Azure SSO token relay (`/api/cloud_tokens`). User-initiated only.

**What remains intact (intentionally):**
- `keysToStatus()` in `LicenseKey.ts` — unused by `getLicenseStatus()` now but still called by the offline-file license path (`OfflineLicense.ts:108`). Keep.
- `CloudClient.getLicense()` signature — same args, same return shape; callers don't need to change.
- `installation_ids` table + `20250404_add_installation_id.js` migration — applied to existing DBs; migration file kept so fresh installs replay cleanly. Table is now write-never/read-never.
- `invalidatedAt` column + `20260421_add_license_invalidated_at.js` migration — column stays in schema, never written.
- `LicenseModule.add()` / `remove()` / `sync()` — UI license-entry modal still triggers these. Add path now hits the stubbed `CloudClient.getLicense()` and persists the synthetic license.

**Reversal:** revert the commits making these changes. Schema is untouched; only TS/Vue source and one migration-free deletion of `installation_id.ts` model class (table itself remains in DB).

---

## Subsequent dead-code removals (this fork)

After the stub above made several upstream paths unreachable, dead code was deleted in a follow-up pass. The originally-stubbed three files still match the table above; everything below documents *additional* removals.

**Files deleted:**
- `apps/studio/src/lib/cloud/controllers/LicenseKeyController.ts` — only consumer was the pre-stub `CloudClient.getLicense()` body.
- `apps/studio/src/common/appdb/models/installation_id.ts` — `InstallationId.get()` had no remaining callers after the handler was removed. The `installation_ids` DB table is still created by `20250404_add_installation_id.js` (migration kept, see "What remains intact" above) but is no longer mapped as a TypeORM entity.

**Files edited:**
- `apps/studio/src/common/appdb/Connection.ts` — dropped `InstallationId` import + entry in the `models` array (TypeORM entity registry).
- `apps/studio/src/common/globals.ts` — removed `licenseCheckInterval` constant (no remaining consumer).
- `apps/studio/src/handlers/licenseHandlers.ts` — removed `license/getInstallationId` handler + interface entry + `InstallationId` import.
- `apps/studio/src/store/modules/LicenseModule.ts`:
  - Dropped `installationId` state field, `installationId` mutation, and `init()`'s `getInstallationId` fetch.
  - Dropped `update()` action (only caller was the now-neutered `updateAll`) and the `inflightUpdates` coalescing map.
  - `add()` now passes `""` for the installationId arg directly into the stubbed `CloudClient.getLicense()`.
  - Dropped the `install` re-export from the `vuex` import line.
- `apps/studio/src/App.vue` — removed `licenseInterval` data field, its `setInterval` registration in `mounted()`, and the matching `clearInterval` in `beforeDestroy()`. The initial `licenses/updateAll` dispatch on mount is retained (it now just refreshes local status).

**Effect:**
- No periodic background tick for license at all. Single `updateAll` runs once on app mount.
- `installationId` is no longer generated, fetched, stored in state, or referenced anywhere in TS source.
- License network controller class no longer exists in the bundle.

**Reversal:** restore the two deleted files from git history; revert the edits in the five files above.
