# CLAUDE.md

Context for Claude Code (or any future session) working on this repo. Read
this before making changes — several conventions here exist specifically
to avoid errors that already happened once during this project's build.

## What this is

A personal Fleet Maintenance, Procurement, Engine Management & Financial
Analytics system for a single Fleet Maintenance Manager (single-user,
no role permissions). Angular frontend, Supabase (PostgreSQL) backend,
deployed to Vercel.

8 tabs: Vehicles, Spare Parts & Procurement, Maintenance, Invoices, Checks,
Overhauls, Garage Lodging, Engines — plus a cross-cutting Analytics view
and the main Dashboard.

## Tech stack

- Angular, standalone components only — **no NgModules anywhere in this
  project.** Every component/route uses `standalone: true` +
  `loadComponent`/`loadChildren`.
- Angular's built-in control flow (`@if`, `@for`, `@switch`) — **not**
  `*ngIf`/`*ngFor`/`*ngSwitch`. Don't import `CommonModule` for structural
  directives; it isn't needed for `@if`/`@for`. Only import it (or a
  specific pipe) if you actually use a `CommonModule` pipe like `date` or
  `currency`. Always give `@for` a `track` expression — use a stable id
  field (e.g. `t.technician_id`), never the array index.
- `@supabase/supabase-js` — one client singleton via
  `core/supabase-client.service.ts`, injected everywhere. Never call
  `createClient()` a second time anywhere else in the app.
- `chart.js` (not ngx-charts — it was swapped out; if you see a stray
  `@swimlane/ngx-charts` reference anywhere, that's stale and should be
  removed). Chart.js needs a real `<canvas>` in the DOM before
  instantiation — see the `dashboard-page.component.ts` pattern (canvas
  always rendered, never behind `@if`, chart created in `ngAfterViewInit`
  and updated in place on data changes rather than destroyed/recreated).
- `xlsx` (SheetJS), `jspdf` + `jspdf-autotable`, `pdfjs-dist`, `mammoth` —
  import/export utilities under `utils/`.

## Directory layout

```
src/app/
├── app.component.*        # side nav shell + router-outlet
├── app.config.ts           # bootstrap providers
├── app.routes.ts            # top-level routes, one per tab
├── core/                    # Supabase client singleton, fromSupabase() helper
├── models/                  # fleet.models.ts — one interface per table/view
├── services/                 # one service per tab/domain concern
├── utils/                    # Excel/PDF/Word import, PDF report generation
├── dashboard/                 # main dashboard + its two sub-components
├── shared/feature-placeholder/  # stand-in for tabs not yet built
└── features/<tab-name>/          # *.routes.ts per tab; swap in real components here as built
```

## The Supabase schema — read this before writing any query

The real schema was provided partway through this project and is
**different from generic assumptions** in a few load-bearing ways:

- `financial_transactions` is not a generic ledger — it **is** the
  petty-cash/check approval workflow (`channel`, `check_number`,
  `check_stage`, `petty_cash_status`, `cost_dept_reviewed_at`,
  `audit_dept_reviewed_at`, `approved_at`, `disbursed_at`). The "Checks"
  tab is just this table filtered to `channel = 'check'` — there is no
  separate `checks` table.
- Vendors (parts suppliers, machine shops, external garages) all live in
  `external_workshops` (extended with a `vendor_type` column), not a
  separate `suppliers` table.
- `vehicles.odometer_km`, `vehicles.maintenance_workshop_id` (which
  already encodes Heavy/Light/Body-Paint via
  `maintenance_workshops.workshop_type`), and
  `vehicles.current_garage_location_id` are the real, pre-existing
  columns — don't reinvent parallel columns for these.
- `disbursement_status` is a real pre-existing enum (default
  `'requested'`) — it was extended via `ALTER TYPE ... ADD VALUE IF NOT
  EXISTS`, never recreated with `CREATE TYPE`.

**Enum labels marked as assumptions, not yet confirmed against the live
DB:** `vehicle_status` (code currently checks for `'active'`),
`maintenance_type`, `bounce_reason`, `channel`, `check_stage`,
`petty_cash_status`. If you touch code that filters on these, check the
real label set first (`select enum_range(null::vehicle_status)` or
similar) rather than assuming.

### Migrations

Two SQL files were produced so far (not included in this `src/` tree —
they live wherever you're tracking DB migrations):

1. **Delta schema v2** — all new tables (`part_price_history`,
   `oil_and_filter_changes`, `invoices`, `invoice_items`,
   `financial_transaction_vehicles`, `stock_disbursement_status_history`,
   `overhauls`, `overhaul_stages`, `garage_lodgings`), triggers, and
   analytics views. Fully idempotent (guarded `CREATE TYPE`, `DROP VIEW
   IF EXISTS ... CASCADE` before every `CREATE VIEW`, guarded `ADD
   CONSTRAINT`) — safe to re-run.
2. **Engine swap sync trigger** — a `BEFORE INSERT` trigger on
   `engine_swaps` that auto-fills `previous_engine_id` and syncs
   `vehicles.current_engine_id`.

If you add more triggers/tables, follow the same idempotency pattern —
this schema gets iterated on and re-run often.

### View naming

`v_technician_kpis` (no `_rollup` suffix) already exists in the live DB
with a different column shape than what this project needed — hence
`v_technician_kpi_rollup` is the name used here for the equivalent view.
Don't rename it back without checking nothing else depends on the
original.

## Service layer conventions

- Every service method returns `Observable<T>` via the shared
  `fromSupabase<T>()` helper in `core/from-supabase.util.ts`. Don't
  `await` Supabase calls directly in a service — wrap them.
- Services are deliberately stateless — no internal `BehaviorSubject`s
  caching data. Components own subscription lifecycle and local state.
  (This project had real bugs elsewhere from `BehaviorSubject` + `skip(1)`
  double-emission patterns — don't reintroduce that shape here.)
- `fromSupabase`'s input type is intentionally loose (`data: any`)
  rather than generic-matched, because without a generated `Database`
  type passed to `createClient<Database>()`, supabase-js can't infer
  real foreign-key cardinality on embedded selects (e.g. `vehicle_types
  (*)` defaults to an array even though it's many-to-one). If you ever
  generate real `Database` types (`npx supabase gen types typescript
  ...`), you can tighten this back up — see the comment block in
  `core/supabase-client.service.ts` for the exact steps.
- DB triggers do a lot of the sync work — don't duplicate it client-side.
  Specifically: oil/filter changes sync `vehicles.odometer_km`, garage
  lodging check-in/out syncs `vehicles.current_garage_location_id`,
  engine swaps sync `vehicles.current_engine_id`, disbursement status
  changes and overhaul stage changes both auto-log their own history
  tables. If a "the vehicle didn't update" bug shows up, check the
  trigger first before adding a second client-side write.

## Design tokens (dashboard + shell)

CSS custom properties defined on `:host` in both
`app.component.scss` and `dashboard-page.component.scss` (duplicated
intentionally so each renders correctly in isolation):

```
--fleet-bg / --fleet-surface / --fleet-ink / --fleet-ink-muted / --fleet-line
--fleet-primary (#1e3a5f) / --fleet-primary-soft
--fleet-amber (#f2a93b) / --fleet-rust (#c4432b) / --fleet-green (#2f9e58)
--fleet-font-display / --fleet-font-body: 'IBM Plex Sans'
--fleet-font-mono: 'IBM Plex Mono' — used for every data readout (odometer figures, counts, currency)
```

Rationale: steel-navy/safety-amber/rust reads as engineering/instrumentation,
appropriate to a fleet tool, rather than generic dashboard-blue. Keep new
UI consistent with these rather than introducing a second palette.

## Setup

```bash
npm install @supabase/supabase-js chart.js xlsx jspdf jspdf-autotable pdfjs-dist mammoth
```

Fill in `src/environments/environment.ts` (and `.prod.ts`) with real
Supabase project URL + anon key. Add the pdf.js worker asset entry to
`angular.json`:

```json
{ "glob": "pdf.worker.min.js", "input": "node_modules/pdfjs-dist/build", "output": "/" }
```

## Known gaps / next steps

- Every tab except Dashboard currently renders `FeaturePlaceholderComponent`
  (see `features/<tab>/*.routes.ts`). Building the real grid/form
  components is the main remaining work — Vehicles is the natural first
  one since it's referenced by nearly every other service.
- `dashboard-page.component.ts` assumes `vehicle_status` includes
  `'active'` and formats currency as EGP — confirm both against the real
  enum/requirements.
- No tests exist yet.
