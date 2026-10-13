# Integration status and configuration

| Adapter          | Implemented behavior                                                                 | Default delivery                |
| ---------------- | ------------------------------------------------------------------------------------ | ------------------------------- |
| Fixture          | Explicit simulation, original timestamps, deliberate outage switch                   | Enabled for demo                |
| BMKG             | Fixed official weather endpoint, administrative code, validated normalized forecasts | Disabled                        |
| PetaBencana      | Fixed crowd-report API, user-agent attribution, bounded normalized community records | Disabled                        |
| InaRISK          | Disclosed reference context; no fabricated operational data                          | Disabled/reference only         |
| AI heuristic     | Quoted facts, missing information, keyword suggestions, group counts                 | Deterministic fallback          |
| Compatible model | Server-side JSON chat completion with schema/evidence validation                     | No approved provider configured |

BMKG weather forecasts are not flood warnings. PetaBencana crowd reports remain
external community reports. Fetch time never substitutes for observation time.
Unknown source observation time stays null. Source attribution, URL, source type,
effective/expiry, version, simulation and verification status remain visible.

Network adapters use fixed endpoints, no redirects, timeout and two-megabyte
response bounds. Invalid/missing data produces a source-run failure. The previous
successful record and its fetch timestamp remain unchanged during an outage.
Other source jobs and core reports/plans continue independently. Administrators
can disable sources; disabled records disappear from current public presentation.

To activate a permitted source, set `ALLOW_LIVE_SOURCES=true` on the API/worker,
then configure its region under Sumber informasi: live mode, explicit authorized
permission, accurate administrative code and reviewed attribution/license note.
Restart API and worker after changing server environment. Refresh is asynchronous;
inspect source-run health and jobs rather than claiming success on enqueue.

The seed intentionally supplies no approved source permissions, real local contacts
or production model credentials. Do not activate live sources for a fictional demo
region and present the result as a real local situation.

Set `AI_MODE=compatible`, `AI_BASE_URL` (HTTPS or localhost), `AI_MODEL` and an
approved server-only `AI_API_KEY` if needed. Requests use `/chat/completions` with
JSON output. A local compatible model may omit a key. The endpoint needs chat
completion/JSON support; arbitrary SDK/model compatibility is not claimed.
`AI_MODE=disabled` preserves human workflows. Failures are inspectable, and manual
regeneration creates a new suggestion without destroying earlier evidence.

Official references consulted: [BMKG forecast data](https://data.bmkg.go.id/prakiraan-cuaca/),
[PetaBencana report API](https://docs.petabencana.id/routes/laporan-urun-daya),
[PetaBencana licensing](https://github.com/petabencana/petabencana-meta/blob/master/petabencana.id/LICENSING.md).
These are integration references, not a claim that this operator has obtained
production permissions, capacity or legal approval. Posko now uses OpenStreetMap
street tiles with visible attribution, normal browser caching and origin-only
referrer. Runtime configuration can disable or replace the provider. Public OSM
tile capacity is best-effort; choose an appropriate provider for operational use.
No offline tile bulk download is implemented. See [map configuration](../features/map.md)
and the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).
