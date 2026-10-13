# Tandara demo flow — 10–12 minutes

Follow one story: a resident prepares for a community exercise, submits an
observation, and a coordinator reviews it with local information and AI support.
Use Kampung Ciliwung throughout. Every report, reference and decision in this
demonstration is simulation data.

## Prepare before presenting

- Open [Warga](http://127.0.0.1:8080) in the main browser. Open
  [Posko](http://127.0.0.1:8081) in a separate browser profile or private window.
- Sign in to Posko as `ciliwung@demo.tandara.test`, using the configured
  `DEMO_PASSWORD`. Keep a separate reviewer session as `admin@demo.tandara.test`
  if showing approval. Select Kampung Ciliwung in each session.
- Check that the current published plan has instructions and checklist items.
  Browser tests may have published another simulation version; choose or prepare
  a reviewed demo plan before the presentation. Do not reset the database.
- Load the street map while online. Confirm the OpenStreetMap attribution and
  local layers are visible.
- Prepare one approved, unexpired synthetic reference in **Asisten Posko →
  Referensi kesiapsiagaan wilayah**. Import it as the coordinator and approve it
  as the separate administrator. Allow the worker to finish indexing it.
- Check **Operasi AI** in the administrator session: the generation mode should
  be `compatible`, with Vikey chat, and embedding mode `compatible`, with Gemini.
  Check available budget and pending work before rehearsal. Avoid repeatedly
  submitting the same demonstration question.
- Keep one completed, cited AI result ready. If the live provider or budget is
  unavailable during the presentation, show that result and clearly identify it
  as an earlier run; never describe it as a new response.

Suggested reference fields:

| Field                              | Value                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| Judul sumber                       | SIMULASI — Dokumen latihan                                                           |
| Teks referensi                     | SIMULASI: siapkan dokumen penting dalam tas latihan.                                 |
| Alamat sumber (HTTPS)              | `https://example.test/simulasi-dokumen-latihan`                                      |
| Izin penggunaan dan pemilik sumber | Referensi sintetis milik demonstrasi Tandara; diizinkan untuk pengujian provider AI. |
| Berlaku sampai                     | A future date after the demonstration                                                |

The example URL is a fictional provenance label for manually supplied text, not
a live external publication. Use a genuine owned source URL if one is available.

## 1. Introduce the two workspaces — 0:00–0:45

**Show:** Warga home, region selector and SIMULASI label. Briefly switch to Posko.

**Say:** “Tandara connects residents and community coordinators. Residents can
prepare, report observations and track their reports. Coordinators can review
those observations, maintain local plans and use source-based AI assistance.”

Point out that the demonstration contains fictional community data. Source-feed
fixtures are labelled simulation; this is not a live BMKG or PetaBencana feed.

## 2. Show resident preparedness — 0:45–2:00

**Do:** In Warga, open **Rencana**, inspect its version, review information and
validity. Click the button to save it to the device. Open **Checklist** and tick
one preparation item.

**Say:** “The resident sees a reviewed local plan and can save it for use when
connectivity is interrupted. Their preparation checklist stays on their device.”

Save the plan now so the offline demonstration is ready later.

## 3. Submit a resident observation — 2:00–3:15

**Do:** Open the report form. Select Kampung Ciliwung and enter:

> SIMULASI DEMO: terlihat genangan di jalan dekat balai latihan.

Use **Balai latihan** as the landmark. Leave observation time and GPS unknown.
Use no real contacts or photos. Check the consent acknowledgement, then click
**Kirim laporan**.

**Show:** The receipt and **Diterima platform** status in **Laporan saya**.

**Say:** “The platform records the observation and gives the resident a tracking
receipt. Missing time or coordinates remain visible as missing information.”

## 4. Review it in Posko — 3:15–5:00

**Do:** Open **Kotak laporan**, search for `SIMULASI DEMO`, and open the new report.
Show the original text, missing information and provisional suggestion. Inspect
the displayed model/source provenance if the suggestion has finished processing.

Enter **Alasan keputusan**:

> Tinjauan manusia pada laporan simulasi demo; waktu dan lokasi rinci belum diketahui.

Optionally enter a separate **Ringkasan publik** for this ordinary observation:

> SIMULASI: pengamatan warga dekat balai latihan telah ditinjau koordinator.

Save the decision. Switch to the resident receipt and reload it to show
**Ditinjau koordinator**.

**Say:** “The suggestion supports the reviewer. The coordinator records the
decision and its reason, and the resident sees the updated tracking status.”

Accepting an AI suggestion and reviewing the report are separate actions. If the
suggestion is unavailable, the coordinator can still review the report.

## 5. Explain the real map — 5:00–6:15

**Do:** Open **Peta situasi**. Pan or zoom once, show street names and
**© OpenStreetMap contributors**, then toggle **Peta dasar** and the report,
plan-location and coverage layers.

**Show:** The text list for reports without a known location. The report just
submitted has no coordinates and should not appear as an invented map point.

**Say:** “This is a real OpenStreetMap street basemap with our community layers
on top. Coverage shows where information exists or is insufficient. A gap in
reports does not establish that an area is safe.”

## 6. Demonstrate cited AI assistance — 6:15–8:45

**Do:** Open **Asisten Posko**. Briefly show the prepared approved reference, then
select **Tanya rencana disetujui** under **Jenis bantuan**. Enter:

> Dokumen apa yang disiapkan dalam latihan?

Click **Buat draf bantuan** once. Follow the new request from **Dalam antrean** or
**Sedang diproses** to **Perlu tinjauan**. Allow extra time for the provider.

Expand a **Sumber** section. Compare the quotation with the source text, and open
**Asal hasil dan riwayat** to show the model and workflow version. Explain the
result actually displayed; do not promise a particular generated sentence.

**Say:** “Gemini embeddings help retrieve relevant approved text. Vikey provides
the DeepSeek chat model that drafts the answer. The answer carries source
quotations, and a coordinator reviews it before using it.”

Enter **Catatan keputusan**:

> Petikan dibandingkan dengan sumber simulasi; diterima sebagai draf latihan.

Click **Terima sebagai draf**, then show the review entry in **Asal hasil dan
riwayat**. Acceptance keeps the result as a private draft; publishing a community
plan requires its own review and publication process.

If the response reports insufficient evidence, show that state honestly and
inspect the sources. A valid abstention is part of the workflow.

## 7. Prove offline access — 8:45–10:00

**Do:** Return to Warga **Rencana**. Set that browser context offline and reload.
Show **Menggunakan data tersimpan**, the saved plan and its timestamp. Reopen
**Checklist** to show the checked item is retained.

For a longer demo, write a second simulation report while offline and select
**Simpan laporan offline**. Show **Menunggu koneksi · belum dikonfirmasi server**.
Restore connectivity and click **Sinkronkan** to obtain its server receipt.

**Say:** “Saved plans and checklists remain available offline. An offline report
stays pending until the server confirms it after synchronization.”

Keep Posko online by applying offline mode only to the Warga browser context.

## 8. Close with accountability — 10:00–11:00

**Do:** In Posko, open **Jejak audit** and show relevant review events. If time
allows, open **Rencana lokal** to explain the separate author/reviewer process.

**Say:** “Tandara connects preparation, resident observations, coordinator review,
local maps and cited AI assistance. Decisions remain accountable to people. This
installation runs as a simulation; production rollout still requires the
documented launch approvals and operational evidence.”

## Optional extensions

- **Independent publication:** Coordinator creates a plan draft and clicks
  **Minta tinjauan**. In the separate administrator session, add a review reason,
  click **Setujui versi**, then **Terbitkan versi ditinjau**. Reload Warga to show
  the published version. Use a complete exercise plan, since publication changes
  the plan residents see.
- **Training:** Complete **Latihan** in Warga, show the explanations, then show
  persisted participation/completion in Posko.
- **Source withdrawal:** Use a disposable demo reference. Withdraw it with a
  reason and show that dependent AI output becomes unavailable. Do this after
  the main AI demonstration.
- **Resident source search:** In Warga knowledge search, search `dokumen` and
  show **Petikan sumber asli**. This screen returns original excerpts rather
  than a generated chat answer.

See the [complete feature walkthrough](demo.md) for private assistance,
duplicates, scoped access, erasure and failure handling.
