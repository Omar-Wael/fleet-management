import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  NgZone,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';

import { VehiclesService } from '../../../core/services/vehicles.service';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { OverhaulsService } from '../../../core/services/overhauls.service';
import { DisbursementService } from '../../../core/services/disbursement.service';
import { InvoicesService } from '../../../core/services/invoices.service';
import { FinancialTransactionsService } from '../../../core/services/financial-transactions.service';
import { VehicleWithLookups } from '../../../core/models/fleet.models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslationService } from '../../../core/i18n/translation.service';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { DataTableQuery } from '../../../shared/components/data-table/data-table.models';

type ProfileTab = 'overview' | 'maintenance' | 'overhauls' | 'parts' | 'finance' | 'timeline';

function effectiveFuelType(v: VehicleWithLookups): string | null {
  return (v as any).fuel_type || v.engines?.fuel_type || null;
}

@Component({
  selector: 'app-vehicle-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe, SharedSearchableSelectComponent, DatePipe, DecimalPipe],
  templateUrl: './vehicle-profile-page.html',
  styleUrl: './vehicle-profile-page.scss',
})
export class VehicleProfilePage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private vehiclesService = inject(VehiclesService);
  private maintenanceService = inject(MaintenanceService);
  private overhaulsService = inject(OverhaulsService);
  private disbursementService = inject(DisbursementService);
  private invoicesService = inject(InvoicesService);
  private ftService = inject(FinancialTransactionsService);
  readonly i18n = inject(TranslationService);
  private zone = inject(NgZone);

  private patch(fn: () => void): void {
    this.zone.run(() => {
      fn();
      this.cdr.detectChanges();
    });
  }

  loading = true;
  error: string | null = null;

  profile: any = null;
  vehicle: VehicleWithLookups | null = null;
  /** مربوط بالـ select */
  selectedVehicleId: string | null = null;

  activeTab: ProfileTab = 'overview';

  kpi = {
    workOrders: 0,
    overhauls: 0,
    disbursements: 0,
    invoices: 0,
    totalCost: 0,
    checks: 0,
  };

  /** نسب بسيطة للرسوم */
  chart = {
    openWorkOrders: 0,
    closedWorkOrders: 0,
    costMaintenance: 0,
    costOverhaul: 0,
    costParts: 0,
  };

  workOrders: any[] = [];
  overhauls: any[] = [];
  disbursements: any[] = [];
  invoices: any[] = [];
  checks: any[] = [];
  timeline: { at: string; kind: string; title: string; meta?: string }[] = [];

  tabLoading = false;
  vehicleOptions: { value: string; label: string }[] = [];

  ngOnInit(): void {
    this.vehiclesService.list().subscribe({
      next: (list) => {
        this.vehicleOptions = list.map((v) => ({ value: v.id, label: v.plate_number }));
        this.cdr.detectChanges();
      },
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.selectedVehicleId = id;
        this.load(id);
      }
    });
  }

  get fuelLabel(): string {
    if (!this.vehicle) return '—';
    return effectiveFuelType(this.vehicle) || '—';
  }

  get ageYears(): string {
    const y = this.vehicle?.manufacture_year;
    if (!y) return '—';
    return String(new Date().getFullYear() - y);
  }

  /** نسبة المفتوح للـ donut */
  get openPct(): number {
    const t = this.chart.openWorkOrders + this.chart.closedWorkOrders;
    return t ? Math.round((this.chart.openWorkOrders / t) * 100) : 0;
  }

  onVehiclePick(id: string | null): void {
    if (!id || id === this.selectedVehicleId) return;
    this.selectedVehicleId = id;
    this.router.navigate(['/vehicles', id]);
  }

  setTab(tab: ProfileTab): void {
    this.activeTab = tab;
    if (!this.vehicle) return;

    if (tab === 'maintenance') {
      if (this.workOrders.length) {
        this.tabLoading = false;
      } else {
        this.loadWorkOrders();
      }
    } else if (tab === 'overhauls') {
      if (this.overhauls.length) {
        this.tabLoading = false;
      } else {
        this.loadOverhauls();
      }
    } else if (tab === 'parts') {
      if (this.disbursements.length) {
        this.tabLoading = false;
      } else {
        this.loadDisbursements();
      }
    } else if (tab === 'finance') {
      if (this.invoices.length || this.checks.length) {
        this.tabLoading = false;
      } else {
        this.loadFinance();
      }
    } else if (tab === 'timeline') {
      this.buildTimeline();
    }

    this.zone.run(() => this.cdr.detectChanges());
  }

  private baseQuery(vehicleId: string): DataTableQuery {
    return {
      page: 1,
      pageSize: 200,
      search: '',
      sort: null,
      filters: {},
    };
  }

  private resetLists(): void {
    this.workOrders = [];
    this.overhauls = [];
    this.disbursements = [];
    this.invoices = [];
    this.checks = [];
    this.timeline = [];
    this.tabLoading = false;
    this.activeTab = 'overview';
    this.kpi = {
      workOrders: 0,
      overhauls: 0,
      disbursements: 0,
      invoices: 0,
      totalCost: 0,
      checks: 0,
    };
    this.chart = {
      openWorkOrders: 0,
      closedWorkOrders: 0,
      costMaintenance: 0,
      costOverhaul: 0,
      costParts: 0,
    };
  }

  private load(id: string): void {
    this.loading = true;
    this.error = null;
    this.resetLists();
    this.cdr.detectChanges();

    this.vehiclesService.getFullProfile(id).subscribe({
      next: (profile) => {
        this.profile = profile;
        this.vehicle = profile.vehicle;
        this.selectedVehicleId = id;
        this.loading = false;
        this.cdr.detectChanges();
        // KPIs + بيانات الـ overview بعد البروفايل
        this.refreshKpisAndOverview(id);
      },
      error: (err) => {
        this.error = err instanceof Error ? err.message : 'Failed to load profile';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private refreshKpisAndOverview(vehicleId: string): void {
    const wo$ = this.maintenanceService
      .listPaged({
        ...this.baseQuery(vehicleId),
        filters: { vehicle_id: vehicleId },
      })
      .pipe(catchError(() => of({ rows: [] as any[], total: 0 })));

    const oh$ = this.overhaulsService
      .listPaged({
        ...this.baseQuery(vehicleId),
        filters: { vehicle_id: vehicleId },
      })
      .pipe(catchError(() => of({ rows: [] as any[], total: 0 })));

    const disb$ = this.disbursementService
      .listPaged({
        ...this.baseQuery(vehicleId),
        filters: { vehicleId },
      })
      .pipe(catchError(() => of({ rows: [] as any[], total: 0 })));

    forkJoin({ wo: wo$, oh: oh$, disb: disb$ }).subscribe({
      next: ({ wo, oh, disb }) => {
        this.patch(() => {
          this.workOrders = wo.rows ?? [];
          this.overhauls = oh.rows ?? [];
          this.disbursements = disb.rows ?? [];

          this.kpi.workOrders = wo.total ?? this.workOrders.length;
          this.kpi.overhauls = oh.total ?? this.overhauls.length;
          this.kpi.disbursements = disb.total ?? this.disbursements.length;

          this.chart.openWorkOrders = this.workOrders.filter((r) => !r.closed_at).length;
          this.chart.closedWorkOrders = this.workOrders.filter((r) => !!r.closed_at).length;
          this.chart.costMaintenance = this.workOrders.reduce(
            (s, r) => s + (Number(r.total_cost) || 0),
            0,
          );
          this.chart.costOverhaul = this.overhauls.reduce((s, r) => {
            const fts = r.financial_transactions ?? [];
            return s + fts.reduce((a: number, t: any) => a + (Number(t.amount) || 0), 0);
          }, 0);
          this.kpi.totalCost = this.chart.costMaintenance + this.chart.costOverhaul;
        });
      },
    });
  }

  loadWorkOrders(): void {
    if (!this.vehicle) return;

    this.patch(() => {
      this.tabLoading = true;
    });

    this.maintenanceService
      .listPaged({
        ...this.baseQuery(this.vehicle.id),
        filters: { vehicle_id: this.vehicle.id },
      })
      .subscribe({
        next: ({ rows }) => {
          this.patch(() => {
            this.workOrders = rows ?? [];
            this.tabLoading = false;
          });
        },
        error: () => {
          this.patch(() => {
            this.workOrders = [];
            this.tabLoading = false;
          });
        },
      });
  }

  loadOverhauls(): void {
    if (!this.vehicle) return;

    this.patch(() => {
      this.tabLoading = true;
    });

    this.overhaulsService
      .listPaged({
        ...this.baseQuery(this.vehicle.id),
        filters: { vehicle_id: this.vehicle.id },
      })
      .subscribe({
        next: ({ rows }) => {
          this.patch(() => {
            this.overhauls = rows ?? [];
            this.tabLoading = false;
          });
        },
        error: () => {
          this.patch(() => {
            this.overhauls = [];
            this.tabLoading = false;
          });
        },
      });
  }

  loadDisbursements(): void {
    if (!this.vehicle) return;

    this.patch(() => {
      this.tabLoading = true;
    });

    this.disbursementService
      .listPaged({
        ...this.baseQuery(this.vehicle.id),
        filters: { vehicleId: this.vehicle.id },
      })
      .subscribe({
        next: ({ rows }) => {
          this.patch(() => {
            this.disbursements = rows ?? [];
            this.tabLoading = false;
          });
        },
        error: () => {
          this.patch(() => {
            this.disbursements = [];
            this.tabLoading = false;
          });
        },
      });
  }

  loadFinance(force = false): void {
    if (!this.vehicle) return;
    if ((this.invoices.length || this.checks.length) && !force) return;

    this.tabLoading = true;
    this.cdr.detectChanges();

    // عدّل حسب API عندك — fallback فاضي بأمان
    const inv$ = (this.invoicesService as any).listPaged
      ? (this.invoicesService as any)
          .listPaged({
            ...this.baseQuery(this.vehicle.id),
            filters: { vehicleId: this.vehicle.id },
          })
          .pipe(
            map((r: any) => r.rows ?? r),
            catchError(() => of([])),
          )
      : of([]);

    const checks$ = this.ftService.listChecks
      ? this.ftService.listChecks().pipe(
          map((rows) =>
            rows.filter(
              (c: any) =>
                c.work_orders?.vehicle_id === this.vehicle!.id ||
                c.external_repairs?.vehicle_id === this.vehicle!.id,
            ),
          ),
          catchError(() => of([])),
        )
      : of([]);

    forkJoin({ inv: inv$, checks: checks$ })
      .pipe(
        finalize(() => {
          this.tabLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: ({ inv, checks }) => {
          this.invoices = (inv as any[]) ?? [];
          this.checks = (checks as any[]) ?? [];
          this.kpi.invoices = (inv as any[]).length;
          this.kpi.checks = checks.length;
        },
      });
  }

  // private ensureTimeline(): void {
  //   // اضمن إن البيانات اتحملت قبل بناء التايملاين
  //   if (!this.workOrders.length) this.loadWorkOrders(true);
  //   if (!this.overhauls.length) this.loadOverhauls(true);
  //   if (!this.disbursements.length) this.loadDisbursements(true);
  //   // بعد شوية قصير نبني (أو ابني في next بتاع كل load)
  //   setTimeout(() => this.buildTimeline(), 300);
  // }

  buildTimeline(): void {
    const events: { at: string; kind: string; title: string; meta?: string }[] = [];

    for (const wo of this.workOrders) {
      if (!wo.opened_at) continue;
      events.push({
        at: wo.opened_at,
        kind: 'maintenance',
        title: wo.description || 'Work order',
        meta: wo.total_cost != null ? String(wo.total_cost) : undefined,
      });
    }
    for (const oh of this.overhauls) {
      if (!oh.entry_date) continue;
      events.push({
        at: oh.entry_date,
        kind: 'overhaul',
        title: oh.scope_description || 'Overhaul',
        meta: oh.current_stage,
      });
    }
    for (const d of this.disbursements) {
      if (!d.requested_at) continue;
      events.push({
        at: d.requested_at,
        kind: 'parts',
        title: d.request_number || 'Disbursement',
        meta: d.status,
      });
    }
    if (this.profile?.lastOilChange?.change_date) {
      events.push({
        at: this.profile.lastOilChange.change_date,
        kind: 'oil',
        title: 'Oil change',
        meta: String(this.profile.lastOilChange.odometer_reading ?? ''),
      });
    }

    this.timeline = events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    this.cdr.detectChanges();
  }
}
