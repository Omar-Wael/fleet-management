import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LookupsService } from '../../../core/services/lookups.service';
import { OperatingDepartment } from '../../../core/models/fleet.models';

interface EditableRow extends OperatingDepartment {
  _draft?: { name_ar: string; name_en: string };
}

const EMPTY_DRAFT = { name_ar: '', name_en: '' };

@Component({
  selector: 'app-departments-tab',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './departments-tab.component.html',
  styleUrls: ['./departments-tab.component.scss'],
})
export class DepartmentsTabComponent implements OnInit {
  rows: EditableRow[] = [];
  loading = true;
  loadError: string | null = null;
  saveError: string | null = null;

  activeOnly = false;
  addingNew = false;
  newDraft = { ...EMPTY_DRAFT };
  saving = false;

  constructor(
    private lookupsService: LookupsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadError = null;

    this.lookupsService.listOperatingDepartments(this.activeOnly).subscribe({
      next: (rows) => {
        this.rows = rows;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load departments.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  startAdd(): void {
    this.addingNew = true;
    this.newDraft = { ...EMPTY_DRAFT };
    this.saveError = null;
  }

  cancelAdd(): void {
    this.addingNew = false;
  }

  confirmAdd(): void {
    if (!this.newDraft.name_ar.trim()) {
      this.saveError = 'Arabic name is required.';
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .createOperatingDepartment({
        name_ar: this.newDraft.name_ar.trim(),
        name_en: this.newDraft.name_en.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.addingNew = false;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err instanceof Error ? err.message : 'Failed to add department.';
        },
      });
  }

  startEdit(row: EditableRow): void {
    row._draft = { name_ar: row.name_ar, name_en: row.name_en || '' };
    this.saveError = null;
  }

  cancelEdit(row: EditableRow): void {
    delete row._draft;
  }

  confirmEdit(row: EditableRow): void {
    if (!row._draft) return;
    if (!row._draft.name_ar.trim()) {
      this.saveError = 'Arabic name is required.';
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .updateOperatingDepartment(row.id, {
        name_ar: row._draft.name_ar.trim(),
        name_en: row._draft.name_en.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err instanceof Error ? err.message : 'Failed to save changes.';
        },
      });
  }

  toggleActive(row: EditableRow): void {
    const nextState = !row.is_active;
    const verb = nextState ? 'Reactivate' : 'Deactivate';
    if (!window.confirm(`${verb}: ${row.name_en || row.name_ar}?`)) return;

    this.lookupsService.setOperatingDepartmentActive(row.id, nextState).subscribe({
      next: () => this.load(),
      error: (err) => {
        this.saveError = err instanceof Error ? err.message : 'Failed to update status.';
      },
    });
  }
}
