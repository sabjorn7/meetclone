# Global Full HD — deployment handoff

Frontend uses only stream_video_quality_capabilities().full_hd_enabled. All existing organizer roles get HD / Full HD on create/edit when enabled; new streams still default to HD. No personal grant is requested. Authorization, RLS, ownership, reservations, max_full_hd_live=1 and media profiles are retained.

## Owner manual SQL — required

Apply the ENTIRE supabase/migrations/pending_stream_full_hd_global.sql in Supabase SQL Editor. It atomically replaces grant-dependent checks, enables full_hd_enabled and notifies PostgREST. It does not change RLS or EXECUTE privileges. Compatibility RPC names remain for the deployed orchestrator, but no authorization path consults the personal grant table. Historical grant rows/table remain private and unused; their ownership-maintenance trigger is removed.

Then run supabase/migrations/verify_stream_full_hd_global.sql. Expect seven PASS rows and {version:1,full_hd_enabled:true}. Refresh /streams/ after applying SQL. No orchestrator restart, LiveKit/Egress/PeerTube change or personal assignment is needed.

Frontend is safe to deploy first while the current global flag is false: Full HD remains unavailable until the owner applies the SQL. Deployment does NOT run the migration. Do not enable only the flag using the old SQL; apply the complete new migration.

## Tests actually run

- Global capability unit: 3 PASS.
- Actual StreamsPage browser tests, mocked integrations: 14 PASS, including creation by two organizers, save-time flag rechecks, disabled flag, stale response and mobile layout.
- Temporary PostgreSQL 15 / PostgREST: 21 PASS, including direct Full HD INSERT by two owners, unchanged RLS/EXECUTE ACLs, verification SQL, owner spoofing denial, scoped reserve/hold/mark, parallel capacity-one admission, failure retention and HD with Full HD disabled. External Egress is represented by a synthetic ID; no actual media is started.
- Existing streams unit: 18 PASS; video-stats unit: 15 PASS; My streams browser: 11 PASS; diagnostics browser: 12 PASS.
- Total: 94 PASS. Vite build without production postbuild: PASS. No new packages installed.

The scoped SQL under tests/fixtures is a disposable predecessor fixture only, never an installation instruction. Integration services listen on 127.0.0.1, use synthetic rows/credentials, and are stopped after testing. The test does not load production env.

## Media and limits

No capture, codec, simulcast, dynacast, Egress or PeerTube settings change. Existing OBS guidance stays: external OBS source resolution must be configured there; the website does not reconfigure it. The existing max_full_hd_live mechanism limits managed LiveKit Egress admission; it is not a new global PeerTube/OBS resource governor.

This release does not prove end-to-end 1080p. Real camera → LiveKit → Egress → PeerTube measurements follow the owner's manual test after SQL activation.

## Disable

Owner applies pending_stream_full_hd_global_disable.sql: global flag=false blocks future Full HD saves/starts without stopping already committed media. HD remains usable. Do not return to the scoped frontend/backend without reviewing the current SQL contract.
