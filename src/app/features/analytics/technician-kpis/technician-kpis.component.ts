import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';

import { TechniciansService } from '../../../core/services/technicians.service';
import { RepairBounce, VTechnicianKpiRollup } from '../../../core/models/fleet.models';
import { exportToExcel, ExcelExportColumn } from '../../../shared/utils/excel-import-export.util';

@Component({
  selector: 'app-technician-kpis',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './technician-kpis.component.html',
  styleUrls: ['./technician-kpis.component.scss'],
})
export class TechnicianKpisComponent implements OnInit {
  rows: VTechnicianKpiRollup[] = [];
  loading = true;
  loadError: string | null = null;

  expandedTechnicianId: string | null = null;
  bounces: RepairBounce[] = [];
  bouncesLoading = false;
  bouncesError: string | null = null;

  constructor(
    private techniciansService: TechniciansService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadRows();
  }

  loadRows(): void {
    this.loading = true;
    this.loadError = null;

    this.techniciansService.getKpiRollup().subscribe({
      next: (rows) => {
        this.rows = rows;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load technician KPIs.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  toggleBounces(technicianId: string): void {
    if (this.expandedTechnicianId === technicianId) {
      this.expandedTechnicianId = null;
      return;
    }

    this.expandedTechnicianId = technicianId;
    this.bounces = [];
    this.bouncesLoading = true;
    this.bouncesError = null;

    this.techniciansService.getBounces(technicianId).subscribe({
      next: (bounces) => {
        this.bounces = bounces;
        this.bouncesLoading = false;
      },
      error: (err) => {
        this.bouncesError = err instanceof Error ? err.message : 'Failed to load bounce history.';
        this.bouncesLoading = false;
      },
    });
  }

  // NOTE: bounce_rate is assumed to already be a 0-1 ratio from the view
  // (rather than a pre-multiplied percentage) — confirm against the live
  // v_technician_kpi_rollup output and adjust bouncePercent()/the bar
  // width below if that assumption is wrong.
  bouncePercent(rate: number): number {
    return Math.max(0, Math.min(100, Math.round((Number(rate) || 0) * 100)));
  }

  exportExcel(): void {
    exportToExcel(this.rows, this.excelColumns(), 'technician-kpi-rollup');
  }

  private excelColumns(): ExcelExportColumn<VTechnicianKpiRollup>[] {
    return [
      { header: 'Technician', accessor: (r) => r.full_name },
      { header: 'Work Orders', accessor: (r) => r.work_orders_count },
      { header: 'Bounces', accessor: (r) => r.bounces_count },
      { header: 'Bounce Rate', accessor: (r) => this.bouncePercent(r.bounce_rate) / 100 },
      { header: 'Disbursement Requests', accessor: (r) => r.disbursement_requests_count },
      { header: 'Overhaul Stages Worked', accessor: (r) => r.overhaul_stages_worked },
    ];
  }
}
