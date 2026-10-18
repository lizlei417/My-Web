# Sticky note account synchronization

The home page and portal shell use `portal_user_data` with the existing own-user
RLS policies. No new table, SQL migration, credentials or service is required.
Active notes and archived notes retain their existing user-scoped storage keys.

Previously the home widget wrote its cached array during loading and session
notifications, did not listen for account restores, and the account layer used
unconditional delayed upserts with no durable retry or cross-device refresh.
This could upload an old cache over a newer note or leave the visible widget
behind the cloud value.

Actual edits now record a per-user durable outbox before the delayed network
save. The outbox survives sign-out, page closure and network failures. Login,
focus, visibility restoration, network recovery and an 8-second visible-page
poll retry uploads and refresh notes. Local input saves immediately; loading,
same-user auth notifications and applying cloud updates do not echo-upload.

Uploads merge each changed note field against the captured local baseline and
the latest cloud array. Unchanged stale text cannot override newer cloud text.
Concurrent edits to different notes or fields merge; conflicting explicit edits
to the same field use the last successful upload. A cloud deletion takes
precedence over a stale edit to that deleted note. Archive moves use the two
existing rows and are eventually consistent, not a transaction.

Updates filter by the fetched `updated_at` revision, request the affected rows,
and retry when another writer won. First inserts use `ignoreDuplicates` and
retry instead of overwriting a concurrent insert. A shared local revision also
rejects delayed older responses from another frame. Failures retain pending
edits and show a local-save/pending or failure label instead of sync success.

Pre-upgrade local notes have no reliable edit history. On the first cloud
restore, a differing nonempty local cache is retained at
`portal:sticky-recovery:user:<id>:homeStickyNotes:v1` (or the archive equivalent),
as `{ value, savedAt }`. This is a recovery copy, not an inferred newer version.
New pending edits use `portal:sticky-pending:<localKey>` and are retried only for
the authenticated owner. Guests remain local.

Validation:

```powershell
node --test v8.0/account-data.test.cjs v8.0/bookkeeping/core.test.js v8.0/schedule/core.test.js
node --check v8.0/account-data.js
node --check v8.0/home/sticky-note.js
```

The account tests simulate separate devices and a shared cloud, including
38-to-46, logout/reload, offline retry, collisions, input during upload, stale
layout writes, archive deletion, account isolation and delayed iframe replies.
An isolated headless Edge component check also verifies immediate input saving,
no load/restore writeback, visible remote updates and the sync status label.
These checks do not authenticate the production account or replace a two-device
test. Existing open tabs on both computers must reload to run the corrected code.
