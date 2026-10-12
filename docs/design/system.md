# Design decisions and visual checks

The Tandara mark uses three receding water lines; original SVG icons and matching
PWA assets are repository-native. Warm off-white surfaces, deep teal actions,
restrained amber uncertainty and flat panels support an editorial community
interface. Tokens live in `packages/ui/src/design.css` with spacing, 6–8 px radii,
typography, focus treatment and semantic states. Status text accompanies color.

Warga emphasizes region/source context and immediate actions, with five mobile
navigation choices and readable forms. Posko uses a persistent desktop sidebar,
scoped region selector, searchable/paginated report tables, separate original and
provisional evidence, and reason-required review. Mobile Posko becomes compact
navigation with horizontally contained tables. Coordinator plan points/access
have ordinary labelled fields rather than requiring structured JSON.

Forms use explicit labels, native required/length constraints, visible errors,
disabled/busy states, privacy explanations and optional GPS. Skip links, visible
keyboard focus, semantic headings/landmarks, textual status, larger-text preference
and reduced-motion styles are provided. Print plans retain metadata/simulation
warnings. There are no invented emergency numbers or safety scores.

Playwright checks widths 360, 390, 768, 1024, 1440 and 1920 for Warga and representative
Posko sizes. Axe WCAG A/AA scans run on seven Warga routes and Posko's main workflows;
keyboard verifies skip-to-main focus. This is automated accessibility evidence,
not a certification or replacement for screen-reader/usability work with residents.

Screenshots are in `docs/qa/screenshots`. Visual review examined desktop and mobile
home, reports, map, plans, assistance, training, sources, audit and administration.
Refinement fixed a 4.35:1 small sidebar label contrast issue, duplicated desktop
logout, missing first-visit service-worker control, and unnecessarily technical
plan/suggestion editing. Inspect the final screenshot set alongside the test
report; no visual claim is based solely on successful compilation.
