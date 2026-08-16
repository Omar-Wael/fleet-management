# Fleet Management System - Project Structure

```bash
fleet-management/
├── src/
│   ├── app/
│   │   ├── app.component.ts
│   │   ├── app.config.ts                 # bootstrapApplication providers (Supabase, router, etc.)
│   │   ├── app.routes.ts                 # Top-level lazy routes (one per tab)
│   │   │
│   │   ├── core/                         # Singletons & app-wide concerns (no UI)
│   │   │   ├── supabase/
│   │   │   │   ├── supabase-client.service.ts
│   │   │   │   └── from-supabase.util.ts
│   │   │   ├── models/
│   │   │   │   └── fleet.models.ts
│   │   │   ├── services/                 # 13 feature services (Step 2)
│   │   │   │   ├── vehicles.service.ts
│   │   │   │   ├── spare-parts.service.ts
│   │   │   │   ├── disbursement.service.ts
│   │   │   │   ├── maintenance.service.ts
│   │   │   │   ├── invoices.service.ts
│   │   │   │   ├── financial-transactions.service.ts
│   │   │   │   ├── overhauls.service.ts
│   │   │   │   ├── garage-lodging.service.ts
│   │   │   │   ├── technicians.service.ts
│   │   │   │   ├── engines.service.ts
│   │   │   │   └── analytics.service.ts
│   │   │   └── guards/
│   │   │
│   │   ├── shared/                       # Reusable UI components, pipes, utilities
│   │   │   ├── components/
│   │   │   │   ├── data-grid/
│   │   │   │   ├── alert-banner/
│   │   │   │   ├── stage-pipeline/
│   │   │   │   ├── file-drop-zone/
│   │   │   │   ├── multi-select-tags/
│   │   │   │   └── vehicle-profile-drawer/
│   │   │   ├── pipes/
│   │   │   │   └── odometer-unit.pipe.ts
│   │   │   ├── directives/
│   │   │   └── utils/
│   │   │       ├── excel-import.util.ts     # SheetJS
│   │   │       ├── excel-export.util.ts
│   │   │       └── pdf-export.util.ts       # jsPDF
│   │   │
│   │   └── features/                     # Feature modules (lazy-loaded)
│   │       ├── dashboard/
│   │       │   ├── dashboard.routes.ts
│   │       │   └── dashboard-page/
│   │       │       └── dashboard-page.component.ts    # Main dashboard (Step 4)
│   │       │
│   │       ├── vehicles/
│   │       │   ├── vehicles.routes.ts
│   │       │   ├── vehicles-list/
│   │       │   ├── vehicle-form/
│   │       │   └── vehicle-profile-drawer/
│   │       │
│   │       ├── spare-parts/
│   │       │   ├── spare-parts.routes.ts
│   │       │   ├── parts-catalog/
│   │       │   ├── price-intelligence/
│   │       │   ├── vendor-directory/
│   │       │   └── disbursement-requests/
│   │       │
│   │       ├── maintenance/
│   │       │   ├── maintenance.routes.ts
│   │       │   ├── work-orders/
│   │       │   └── oil-filter-tracker/
│   │       │
│   │       ├── invoices/
│   │       │   ├── invoices.routes.ts
│   │       │   ├── invoices-list/
│   │       │   └── invoice-form/
│   │       │
│   │       ├── checks/
│   │       │   ├── checks.routes.ts
│   │       │   └── checks-list/
│   │       │
│   │       ├── overhauls/
│   │       │   ├── overhauls.routes.ts
│   │       │   ├── overhauls-list/
│   │       │   └── overhaul-pipeline/
│   │       │
│   │       ├── garage-lodging/
│   │       │   ├── garage-lodging.routes.ts
│   │       │   └── lodging-list/
│   │       │
│   │       ├── engines/
│   │       │   ├── engines.routes.ts
│   │       │   └── engines-catalog/
│   │       │
│   │       └── analytics/
│   │           ├── analytics.routes.ts
│   │           ├── cost-by-vehicle/
│   │           ├── cost-by-department/
│   │           ├── technician-kpis/
│   │           └── vendor-price-comparison/
│   │
│   ├── environments/
│   │   ├── environment.ts
│   │   └── environment.prod.ts
│   ├── styles.scss                          # Tailwind + design tokens
│   ├── main.ts
│   └── index.html
│
├── angular.json
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vercel.json                              # Vercel deployment config
└── README.md
