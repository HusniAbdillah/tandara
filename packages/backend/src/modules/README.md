# Business modules

Place server-only feature modules here: auth, reports, plans, regions, triage, and audit.
Create a module when its first vertical slice is implemented; avoid empty module scaffolds.

- Own repositories inside their business module, not in the database package.
- Export explicit operations; another module may not access private repositories.
- Keep policy and state transitions callable by HTTP and background jobs.
- Domain rules must not depend on controllers or job consumers.
- Add domain/application/infrastructure subdirectories only when complexity warrants them.
- Worker operations enforce their own service permissions; HTTP guards do not run in a standalone context.
