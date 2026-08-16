import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LookupsService } from '../../../core/services/lookups.service';
import { MaintenanceWorkshop } from '../../../core/models/fleet.models';

interface Draft {
  workshop_type: string;
  name_ar: string;
  name_en: string;
  location_notes: string;
}

interface EditableRow extends MaintenanceWorkshop {
  _draft?: Draft;
}

const EMPTY_DRAFT: Draft = { workshop_type: '', name_ar: '', name_en: '', location_notes: '' };

@Component({
  selector: 'app-workshops-tab',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './workshops-tab.component.html',
  styleUrls: ['./workshops-tab.component.scss'],
})
export class WorkshopsTabComponent implements OnInit {
  rows: EditableRow[] = [];
  loading = true;
  loadError: string | null = null;
  saveError: string | null = null;

  addingNew = false;
  newDraft: Draft = { ...EMPTY_DRAFT };
  saving = false;

  readonly workshopTypes = ['light_transport', 'heavy_transport', 'body_paint'];

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

    this.lookupsService.listMaintenanceWorkshops().subscribe({
      next: (rows) => {
        this.rows = rows;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load workshops.';
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
    if (!this.newDraft.name_ar.trim() || !this.newDraft.workshop_type.trim()) {
      this.saveError = 'Arabic name and workshop type are required.';
      return;
    }

    this.saving = true;
    this.saveError = null;
    console.log(this.newDraft);
    this.lookupsService
      .createMaintenanceWorkshop({
        workshop_type: this.newDraft.workshop_type.trim(),
        name_ar: this.newDraft.name_ar.trim(),
        name_en: this.newDraft.name_en.trim() || null,
        location_notes: this.newDraft.location_notes.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.addingNew = false;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err instanceof Error ? err.message : 'Failed to add workshop.';
        },
      });
  }

  startEdit(row: EditableRow): void {
    row._draft = {
      workshop_type: row.workshop_type,
      name_ar: row.name_ar,
      name_en: row.name_en || '',
      location_notes: row.location_notes || '',
    };
    this.saveError = null;
  }

  cancelEdit(row: EditableRow): void {
    delete row._draft;
  }

  confirmEdit(row: EditableRow): void {
    if (!row._draft) return;
    if (!row._draft.name_ar.trim() || !row._draft.workshop_type.trim()) {
      this.saveError = 'Arabic name and workshop type are required.';
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .updateMaintenanceWorkshop(row.id, {
        workshop_type: row._draft.workshop_type.trim(),
        name_ar: row._draft.name_ar.trim(),
        name_en: row._draft.name_en.trim() || null,
        location_notes: row._draft.location_notes.trim() || null,
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
}
