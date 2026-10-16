# Tandara Warga design handoff

[Editable Figma design](https://www.figma.com/design/64n9YH2tieTKiDBHbYJoXZ) · [Mobile prototype](https://www.figma.com/proto/64n9YH2tieTKiDBHbYJoXZ?node-id=5-11&starting-point-node-id=5%3A11)

## Direction

A fresh resident experience with short Indonesian copy, Chalk backgrounds, teal actions, white cards and Plus Jakarta Sans. Four destinations: Beranda, Peta, Panduan and Laporan. The first screen explains the purpose through nearby places, local updates and clear actions.

## Coverage

The active Chalk designs contain 52 mobile screens and 24 desktop layouts. Nine desktop layout exercises and the earlier mobile designs remain available as references. Active flows use report status and a unified map with observation detail examples; chat is removed from the active designs. See [the implementation handoff](warga-chalk-implementation.md) for the delivered code, API integration boundary and validation.

| Journey        | Designed states                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| First visit    | Welcome, region selection, manual area entry, home                                     |
| Map            | Pins, place sheet, place details, filters, search, list and empty results              |
| Reporting      | Category, description, optional photo, location, review, sharing choice and submission |
| Follow-up      | Report list, timeline, replies, completed reports and deletion request                 |
| Community help | Request, contact sharing choice, submitted state and private timeline                  |
| Preparedness   | Local plan, family checklist, completion, saved plan and queued offline report         |
| Learning       | Three-question exercise, feedback and result                                           |
| Preferences    | Text size, language and update preferences                                             |

## Figma structure

- Resident journeys: all mobile screens and prototype starting points.
- Components & tokens: semantic colors, spacing, radii, typography, icons, buttons, navigation, rows, fields and checklist states.
- Desktop: home, unified map, water locations, earthquake catalogue, report entry/location/review/receipt, report tracking, separate chat, help/contact/receipt/private follow-up, local plan/checklist, downloads, three quiz questions and results.

All UI is editable native Figma layers. Maps are editable street illustrations for the design; implementation should connect them to the map provider and real place data.

### Chalk mobile copy

The separate `Tandara Warga · Mobile · Chalk` section (`177:5155`) uses Chalk `#F8F8F6` backgrounds and contains 52 screens after authentication/profile updates and chat removal. The three chat states and their presentation starting point were removed from Chalk, along with the report detail's chat button and empty action footer. The related notification opens report status. Original mobile flows, background explorations and desktop designs are preserved. The default prototype starts at login `197:7541`; its home is `177:5235`. Navigation targets stay inside the Chalk version, which uses an isolated background variable collection.

Login (`197:7541`) and registration (`197:7581`) each have phone and password fields, a primary action and a link to switch forms. Their form blocks are centered at `(195, 422)` in a `390 × 844` phone frame. The layout follows the supplied [Grubhub login reference](https://mobbin.com/screens/0265a94e-707b-423a-87df-6564b6c4c293), adapted to Tandara with no external-provider sign-in. Login opens the home screen; registration opens area selection. The four Chalk settings screens and their settings-only entry buttons were removed. Ten main headers now place a linked avatar beside notifications; it opens Profile (`197:7621`), with account identity, downloads, reports and logout. The avatar is an editable default portrait component (`196:7539`).

## Implementation behavior

Allow residents to explore without creating an account. Keep private help requests separate from public map layers. Preserve explicit contact-sharing choices. Distinguish locally queued reports from received reports. Use verified locations rather than guessing missing coordinates. Treat report deletion as a request with its own acknowledgement.

The prototype demonstrates navigation and representative states. Application changes are outside this design deliverable.

### Revised copy and conversation structure

The revised mobile page is `61:7609`; the revised desktop page is `61:6893`. Originals are preserved. Use “Unduhan” for downloaded content and plain text for quiz step counters. Report details show a report summary card and status timeline. “Chat dengan Posko” opens a separate chat screen with Discord-inspired avatars, grouped sender/time/message rows and a fixed composer. “Lihat laporan” returns to the report. Mobile chat states cover opening the conversation, writing a reply and the sent message.

There is no report-title input. Report detail cards show the selected category, original description and report number. A report-list preview may use a short summary derived from the submitted description. Do not invent a location or details absent from the submission.

The contact form uses a full-width “Boleh dihubungi Posko” switch row, with interactive On and Off variants. When Off, omit the phone number from the help request and keep submission available. The revised form preserves the previous selected state as its prototype starting state.

### Desktop parity update

The main desktop flow now applies the selected layouts: report submission (`140:2090`) and help submission (`141:1202`) return to the shared Laporan saya layout with the corresponding selection; normal report (`61:7193`) and help (`142:4064`) views omit the submission banner. E1 is applied to Unduhan (`141:1261`) with a second state for the saved checklist (`216:3076`). F1 is applied to Hasil kuis (`141:1577`). Main screens no longer navigate into exercise copies.

Desktop journeys are grouped into Account (`217:3271`), Beranda & peta (`217:3273`), Laporan & permintaan bantuan (`217:3275`), and Panduan, unduhan & kuis (`217:3277`). Login (`217:2762`) and registration (`217:2793`) are centered at `(720, 512)` in a `1440 × 1024` canvas. Profile (`217:2828`) opens from the header avatar and provides downloads, reports and logout. Settings entry points and the legacy desktop chat screen are removed. Presentation defaults to login, with additional starts for home, reporting, help and guides. Mobile is unchanged.

Selected direction: F1 (`212:2203`) is the accepted quiz-result exercise. G (`212:2406`) is now a second state of D's same “Laporan saya” layout, with the shared report/request list and the help request selected. D's help row opens G; G's incident row opens D. E1 and E2 remain alternative download designs, not consecutive screens: E1 is a dedicated list-and-preview workspace; E2 places downloads in a guide tab.

The next exercise board (`212:1870`) explores context-specific alternatives to sparse screens: E1 download list with document preview (`212:1873`), E2 downloads inside the guide (`212:2015`), F1 quiz score with individual answer review (`212:2203`), F2 completed quiz inside the guide (`212:2281`), and G private help confirmation within request status (`212:2406`). The user selected report proposal D (`206:1845`); the other patterns remain separate proposals for review. Main layouts and mobile remain unchanged by this exercise pass. References: Midday file preview and Codecademy quiz review on Mobbin.

Desktop page backgrounds use Chalk `#F8F8F6`. Four retained “Laporan terkirim” exercises are grouped in `206:1636`: centered confirmation (`206:1639`), centered receipt card (`206:1694`), two-column receipt (`206:1769`), and confirmation inside the report list (`206:1845`). The exercises use native components, including reusable receipt metadata (`205:305`). Selected proposals are now applied to the main flow described above.

The revised desktop page (`61:6893`) uses the latest mobile wording and component patterns. Reporting (`61:7043`) is now one page with category, description, optional photo and observation time on the left, and the map, location, recipient and submission action on the right. The separate location (`140:1972`) and review (`140:2031`) screens were removed and incoming links redirected. Help requests retain the contact-sharing switch. Their status summary and timeline match the report layout, without a “Ke beranda” action. Guide actions open downloads and the three-question quiz. Quiz choices have independent per-question single-selection prototype variables. Desktop navigation stays on the desktop page.

Validation: 24 main desktop frames, all reachable from login, native editable nodes, Plus Jakarta Sans throughout, no image-filled UI, no missing prototype targets and no navigation outside the main desktop flow. Main layouts were visually reviewed at desktop proportions.

### Full-screen desktop map and dashboard refinement

Peta (`61:6964`) opens with a native editable map covering the entire 1208 × 1024 area beside the 232 px navigation sidebar. Search and “Filter & legenda” float over the map. Filters (`225:9962`), water locations (`140:2149`), earthquake results (`140:2230`), Cantiga detail (`224:3436`) and the sample M4.1 earthquake detail (`224:3524`) use a 384 px secondary sidebar over the same map canvas. Detail back arrows return to their lists; closing a panel returns to the full map. Layer switches preserve their existing prototype variables. Only one representative detail per dataset is provided. The structure follows the [PamPam map and location panel reference](https://mobbin.com/screens/a800ff75-f9bd-46c4-b698-7ea3bb689e70) from Mobbin.

Beranda (`61:6894`) now has three equal action cards and an aligned two-column grid: map on the left, updates and the family checklist stacked on the right. The grid uses consistent spacing and aligned outer edges. Mobile and the earlier exercises are unchanged. The default presentation still starts at desktop login.

### Map observation layers

One map combines nearby places/reports, water observations and a sample earthquake. The Filter & legenda panel has independent visibility switches for Lokasi sekitar, Tinggi air and Gempa; separate map tabs and dedicated water/earthquake overview screens were removed. Prototype variables preserve switch state and control marker visibility. Water markers use Normal, Siaga and Awas colors with text labels. Observation details contain only location, height in cm, source status, update time and location-specific height groups. Cantiga–Karang Tengah uses the supplied 57 cm / Normal / 15 Oct 2026 20:00 observation and boundaries Normal <151 cm, Siaga 151–200 cm, Awas >200 cm. The <151 interpretation follows the supplied adjacent ranges. Two additional water observations and pin positions are mock data explicitly authorized by the user.

The unified map uses one representative earthquake marker. The 15-event catalogue remains a list-layout example, with only one detail screen: M 4.1 near Bogor. Its map marker and first catalogue row open that detail; other list events are visual examples. Fourteen redundant detail frames were removed. The representative detail shows date/time, magnitude, depth, region, coordinates and felt intensities/areas. Magnitude is not mapped to water status colors. UI and map layers remain editable Figma nodes.

Mobile entry points: unified map `61:7758`, Filter & legenda `61:8591`, Cantiga details `110:3302`, sample earthquake detail `110:3428`, earthquake catalogue `110:3371`. Desktop unified map: `61:6964`.

The filter uses label-only switches for Tinggi air and Gempa, without the Normal/Siaga/Awas legend or earthquake explanation. Two grouped navigation rows with icons and chevrons open Lokasi tinggi air and Daftar gempa. The apply action stays fixed at the bottom. The water location list (`131:2980`) shows three observations with location, height, status and update time; each row opens its existing observation detail. Location-specific thresholds remain in those details. Toggle state variables and map marker bindings are preserved.

## Reference patterns

- [Pangea map and place sheet](https://mobbin.com/screens/458cf9f7-3942-4b09-8cf4-38ddb9a2d3a7)
- [Apple Maps issue reporting](https://mobbin.com/flows/4df8c077-6be3-4c00-b4aa-9039385f7f49)
- [Bird reporting flow](https://mobbin.com/flows/4bb0fda2-0003-46b3-b0e0-9ab39d7a7721)
- [Pangea compact map filters](https://mobbin.com/screens/fe28c75e-a9de-4d35-b414-8245bc6f548f)
- [Starbucks map and location list](https://mobbin.com/screens/6137bdfc-9652-483d-b11e-15f10d0edcb2)

Original Tandara layouts were created from these interaction references; reference screenshots are not embedded in the deliverable.
