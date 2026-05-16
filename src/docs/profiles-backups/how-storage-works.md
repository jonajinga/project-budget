---
title: "How storage works"
subtitle: "Two backends, mirrored writes, and a versioning story that survives upgrades."
category: "profiles-backups"
order: 3
---

Project Budget keeps your data in your browser. Specifically, in two browser stores: the older **localStorage** and the newer **IndexedDB** (via Dexie). Every write goes to both. Every read comes from the one that has the data.

## Why two

- **localStorage** is small (5&ndash;10 MB) but synchronous and predictable. The app uses it for the live profile and the live profile index because that's what the UI reads when it renders.
- **IndexedDB** has effectively no size cap (browsers grant gigabytes) and is more durable across browser session resets. The app uses it as a mirror, plus as the home for daily backups and manual snapshots once they age out of localStorage.

If localStorage gets cleared (a site-data wipe, an over-zealous browser cleanup) but IndexedDB persists, Project Budget restores your profiles from IndexedDB on the next boot. The reverse is also true: if IndexedDB is unavailable (private browsing, very old browser), Project Budget keeps working on localStorage alone.

You can see which backend is active on the [Settings](/app/settings/) page under "Storage backend."

## How upgrades stay safe

There are two independent version numbers in the system, and we are careful about both:

**Dexie schema version** — covers table shapes and indexes in IndexedDB. When a future release needs a new index or a new table, we add a `db.version(N)` block to the wrapper. Dexie walks every user from their existing version up to the latest one in order. No version is ever edited after it ships; new behavior goes in a new block. Adding an index does not require a data transform; restructuring data does, and the transform is written inside the version block as `.upgrade(tx => ...)`.

**Profile schema version** — covers the shape of one profile bundle: accounts, categories, transactions, goals. Stored as `schemaVersion` on every profile. When a field is added or renamed, we bump `SCHEMA_VERSION` and append a migration step to `MIGRATIONS`. The migration runner loads each profile, walks it from its stored version to the current one, and saves it back. A single Dexie table can hold profiles at v1, v2, and v3 simultaneously; the loader normalizes them on read.

Why two: they evolve at different paces. Adding an index for faster transaction lookup is a Dexie change with no profile-shape impact. Renaming a category field is a profile-schema change with no Dexie impact. Keeping them independent means we never have to ship a database migration just because we want to add a UI affordance, and we never have to break a saved profile just to add a query index.

## What's actually stored

Your data is stored under keys prefixed with `projectbudget:` (in localStorage) and in tables named `profiles`, `snapshots`, `backups`, `trash`, and `meta` (in IndexedDB, database name `ProjectBudget`).

- **profiles** &mdash; one entry per profile bundle, indexed by id, name, and updatedAt
- **snapshots** &mdash; manual snapshots you take, composite key [profileId+snapshotId]
- **backups** &mdash; daily auto-snapshots, composite key [profileId+day]
- **trash** &mdash; soft-deleted profiles awaiting 7-day purge
- **meta** &mdash; active profile id, the localStorage-migrated flag, future settings

## Private browsing

In a private / incognito window, both backends are typically ephemeral &mdash; they exist for the session and get wiped on close. Project Budget detects this on boot and surfaces a persistent banner reminding you to export before the window closes. The app still works normally during the session.
