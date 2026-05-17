---
title: "Manual snapshots and restore"
subtitle: "Save a named point-in-time copy before any risky change. Restore in one click."
category: "profiles-backups"
order: 4
---

A snapshot is a labelled copy of the active profile at a moment you chose. Distinct from the [daily auto-backup](/docs/profiles-backups/backups-and-export/) which Project Budget creates on its own once per day, a snapshot is explicit — you press a button, you give it a name.

## When to take a snapshot

Three situations are worth the 5-second effort:

- **Before a destructive operation.** A bulk delete, a category restructure, an import you're not sure about. The snapshot lets you undo.
- **Before a recurring milestone you want to be able to compare back to.** *End of 2025*, *Pre-mortgage-refi*, *After bonus*.
- **Before a Project Budget version upgrade that touches schema.** The release notes flag these.

## How

From [Settings](/app/settings/), click **Take snapshot**. Name it; the field defaults to a timestamp. Project Budget writes a copy to the snapshots table in IndexedDB. The active profile is untouched.

## Listing and restoring

The Settings page shows a list of snapshots with name, date, and size. Each row has *Restore*, *Export*, and *Delete*.

- **Restore** — overwrites the active profile with the snapshot's contents. Before overwriting, Project Budget takes an automatic *Pre-restore snapshot* so a bad restore is itself undoable.
- **Export** — downloads the snapshot as a JSON file, the same format as the regular [export](/docs/profiles-backups/backups-and-export/). Useful for cross-device transfer.
- **Delete** — removes the snapshot. There's no soft-delete for snapshots; the deletion is immediate.

## How many to keep

There's no hard limit. Each snapshot is roughly the size of your profile, typically a few hundred KB for a year of data, low MB for a heavy multi-year profile. Browsers grant IndexedDB databases gigabytes, so the practical ceiling is hundreds of snapshots.

Healthy hygiene: keep monthly *End-of-month* snapshots for the current year, plus any *Before X* snapshots that document specific decisions. Prune the rest annually.

## Comparing two snapshots

There is no built-in diff view. Two ways to compare:

- **Export both, diff the JSON.** `diff snapshot-a.json snapshot-b.json` in any terminal. Verbose but complete.
- **Restore one, take a screenshot of the reports, restore the other, screenshot again.** Manual but visual.

A diff view is on the roadmap but not currently shipped.

## Snapshots vs daily backups

Both are local-only copies of the profile. The differences:

| Aspect           | Snapshot                       | Daily backup                          |
|------------------|--------------------------------|----------------------------------------|
| Trigger          | You click a button             | Automatic, once per calendar day       |
| Retention        | Until you delete               | 14 days, then pruned                   |
| Name             | You provide                    | The date                                |
| Storage          | IndexedDB only                 | Both localStorage and IndexedDB        |
| Restore protect  | Pre-restore snapshot auto-created | Today's daily backup kept intact   |
| Export option    | Yes — per-snapshot JSON        | No — restore first, then export        |

Use snapshots for deliberate checkpoints; rely on daily backups as the always-on safety net.

## Restoring from trash

Deleted *profiles* (not snapshots) sit in a soft-delete trash for 7 days. See [Multiple profiles](/docs/profiles-backups/profiles/) for that flow. Deleted snapshots do not — they're gone immediately. If you might want a snapshot back, export it to a file before deleting.

## Snapshots and migrations

When a Project Budget release bumps the profile schema, snapshots are migrated on read: the loader sees the snapshot's older `schemaVersion` and walks the migration chain to current before restore. You never need to manually migrate a snapshot.

The same is true for exported snapshot JSON files imported into a newer app version.
