import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslationService } from '../../../core/i18n/translation.service';
import {
  ReportGroupBy,
  ReportKind,
  ReportPeriod,
  ReportsService,
} from '../../../core/services/reports.service';
import {
  ExcelExportColumn,
  exportToExcel,
} from '../../../shared/utils/excel-import-export.util';
import { downloadGridReportPdf, PdfReportColumn } from '../../../shared/utils/pdf-report.util';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './reports-page.component.html',
  styleUrls: ['./reports-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPageComponent implements OnInit {
  private readonly reports = inject(ReportsService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly i18n = inject(TranslationService);

  kind: ReportKind = 'overhauls';
  groupBy: ReportGroupBy | '' = '';
  periodFrom = '';
  periodTo = '';
  allTime = true;

  loading = false;
  error: string | null = null;
  title = '';
  columns: { key: string; header: string }[] = [];
  rows: Record<string, string | number | null>[] = [];
  chart: { labels: string[]; values: number[] } | null = null;

  readonly kinds: { value: ReportKind; labelKey: string }[] = [
    { value: 'overhauls', labelKey: 'reports.kind.overhauls' },
    { value: 'maintenances', labelKey: 'reports.kind.maintenances' },
    { value: 'item_usage', labelKey: 'reports.kind.itemUsage' },
    { value: 'disbursement_requests', labelKey: 'reports.kind.disbursements' },
  ];

  readonly groupBys: { value: ReportGroupBy | ''; labelKey: string }[] = [
    { value: '', labelKey: 'reports.groupBy.none' },
    { value: 'department', labelKey: 'reports.groupBy.department' },
    { value: 'repair_department', labelKey: 'reports.groupBy.repairDepartment' },
    { value: 'technician', labelKey: 'reports.groupBy.technician' },
    { value: 'department_cars', labelKey: 'reports.groupBy.departmentCars' },
  ];

  ngOnInit(): void {
    /* filters loaded on demand */
  }

  runReport(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    const period: ReportPeriod = this.allTime
      ? { from: null, to: null }
      : { from: this.periodFrom || null, to: this.periodTo || null };

    this.reports
      .buildReport(this.kind, period, this.groupBy || null)
      .subscribe({
        next: (res) => {
          this.title = res.title;
          this.columns = res.columns;
          this.rows = res.rows;
          this.chart = res.chart ?? null;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error =
            err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  exportExcel(): void {
    if (!this.rows.length) return;
    const cols: ExcelExportColumn<Record<string, string | number | null>>[] = this.columns.map((c) => ({
      header: c.header,
      accessor: (row) => row[c.key],
    }));
    const safeName = (this.title || 'report').replace(/[^a-zA-Z0-9-_]+/g, '_');
    exportToExcel(this.rows, cols, safeName);
  }

  exportPdf(): void {
    if (!this.rows.length) return;
    const cols: PdfReportColumn<Record<string, string | number | null>>[] = this.columns.map((c) => ({
      header: c.header,
      accessor: (row) => row[c.key],
    }));
    const safeName = (this.title || 'report').replace(/[^a-zA-Z0-9-_]+/g, '_');
    downloadGridReportPdf(this.rows, cols, { title: this.title || 'Report' }, safeName);
  }

  chartMax(): number {
    if (!this.chart?.values?.length) return 1;
    return Math.max(...this.chart.values, 1);
  }
}
