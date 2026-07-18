# Offline entry contract

Status: implemented MVP contract  
Date: 2026-07-18  
Scope: synthetic VAIC demonstration accounts only

## Decision

NekoPath separates **online authentication** from **offline device entry**. A new profile is
verified by the Fastify server once. The browser then keeps only the sanitized identity fields that
the deterministic local core needs. It never stores the password, the opaque session cookie or a
JWT, and Workbox continues to exclude `/api/**`.

This gives a rural classroom a useful recovery path without pretending that a disconnected browser
can contact an identity provider.

## State contract

| Situation | Product behavior | Trust boundary |
|---|---|---|
| New device, network available | Load class directory and verify the selected profile online | Server is authoritative |
| Active verified profile, network lost | Restore the last active device profile and continue local work | Previously confirmed device state |
| User switches profile while offline | Show and open only profiles previously confirmed on this device | No arbitrary roster entry |
| New device or unconfirmed profile, network lost | Explain that one connection is required and offer retry | Never invent an offline credential |
| Server explicitly returns `401` | Clear the active cached identity and return to the selector | An authoritative response beats cache |

## Stored data

- `nekopath.session-cache.v1`: the current sanitized identity for bounded offline restore;
- `nekopath.device-profiles.v1`: sanitized profiles confirmed by a successful session or login;
- IndexedDB: learner events, overrides and outbox records, already keyed by learner/domain IDs;
- HttpOnly cookie: owned by the browser/server session boundary and unavailable to application
  JavaScript.

No password, password hash, bearer token, session ID or cached auth API response is written to
LocalStorage, IndexedDB or Cache Storage.

## Honest limitation

This event build uses synthetic people and a shared demonstration credential. The device-profile
picker is therefore convenience and continuity, not a production-grade shared-device security
boundary. A school pilot with real children must additionally provide:

1. roster provisioning and consent;
2. per-profile IndexedDB partitioning for every learner-owned record;
3. a local unlock factor such as a short device PIN or managed-device account;
4. a signed, expiring offline grant with reconnection/revocation policy; and
5. an explicit “remove this profile from device” operation.

Those controls are deliberately not simulated in the 48-hour MVP.

## Acceptance checks

1. Confirm a profile online, switch out, make the directory unavailable and reopen it without an
   `/api/auth/login` call.
2. Verify that an unknown profile cannot be resumed locally.
3. Verify that a server `401` clears the active identity.
4. Verify offline hard reload and local event writes still work.
5. Verify reconnect sync remains idempotent and `/api/**` is absent from Workbox runtime caching.
