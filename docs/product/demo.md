# Complete simulation walkthrough

Start the full Compose stack using README. Use two browser contexts (normal and
private window) so Warga and coordinator decisions can be observed independently.
All people, regions, report content, source feeds and plans are fictional.

1. Open Warga at 8080, choose Kampung Ciliwung. Read the SIMULASI label and expand
   source/time metadata in Informasi wilayah. BMKG/PetaBencana are deliberately
   disabled; the demo feed is a clearly labelled fixture.
2. Open Rencana: inspect version, community owner, independent reviewer, expiry
   and accessibility notes. Save offline. Check one household checklist item.
3. Submit a report with observed text and a landmark; leave time/GPS unknown to
   exercise uncertainty. Consent is required. Optional contacts require separate
   permission; photos are optional. Retain the receipt in Laporan saya.
4. Sign into Posko as the Ciliwung coordinator. Search Kotak laporan, open the
   report. Original text stays separate from the provisional suggestion. Inspect
   missing location/time, quoted facts, source IDs and deterministic provenance.
   Accept, correct or reject a suggestion with a reason; the report is still
   awaiting human review.
5. Review seeded nearby reports and duplicate hints. Link, dismiss or undo a link
   with a reason. Both originals remain; nothing is silently merged or deleted.
6. Record a human report decision and optional separate public summary. A private
   assistance report cannot have a public summary. Warga tracking shows the new
   status without revealing coordinator identities or private notes.
7. Open Peta situasi. Toggle coverage, reports and plan locations. Blank coverage
   means insufficient information, never safety. Reports without known location
   are listed separately; the map does not guess their position.
8. In Tindak lanjut, assign the seeded private assistance request to its owning
   organization, add a minimal private note and record progress. Receipt status
   reflects progress; no help dispatch or emergency response is promised.
9. In Rencana lokal, create a draft with ordinary instruction/checklist/location
   fields. Add a reason and request review. Sign in separately as administrator,
   approve the version (author cannot approve their own), then publish. Previous
   publication is archived; Warga receives the new immutable version.
10. Save the new plan in Warga, disconnect networking and reload. Read the saved
    timestamp and warning, confirm checklist state, write a consented offline text
    report. It remains pending without a server receipt. Reconnect and synchronize;
    stable keys give one accepted receipt even if network delivery is retried.
11. Complete Latihan: answer questions on sources, gaps and offline reports.
    Review explanations and submit non-sensitive feedback. Posko shows persisted
    aggregate participation/completion and restricted feedback; the score is not
    a safety prediction.
12. Administrator: inspect organizations, scoped users and region settings; disable
    a source or enable the fixture's deliberate failure checkbox then refresh it.
    Observe failed updates retaining old success time while reports/plans work.
    Restore the fixture setting. Check actual jobs/heartbeat and the audit trail.
13. Open Pembaruan, mark a simulation update read and opt out of new updates.
    No SMS/email/emergency alerts are sent. In Warga, request report erasure with
    its receipt; process it in Admin → Operasional and inspect the audit event.

The Semarang coordinator must be denied Ciliwung private routes even with a valid
session. Visit a direct unauthorized API route to confirm server enforcement;
changing dropdowns or URLs cannot grant membership. Never use real personal data
in this demonstration.
