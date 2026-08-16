import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LookupsService } from '../../../core/services/lookups.service';
import { GarageLocation, MaintenanceWorkshop } from '../../../core/models/fleet.models';

interface Draft {
  garage_name: string;
  workshop_id: string | null;
  zone_label: string;
  notes: string;
}

interface EditableRow extends GarageLocation {
  _draft?: Draft;
}

const EMPTY_DRAFT: Draft = { garage_name: '', workshop_id: null, zone_label: '', notes: '' };

@Component({
  selector: 'app-garage-locations-tab',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './garage-locations-tab.component.html',
  styleUrls: ['./garage-locations-tab.component.scss'],
})
export class GarageLocationsTabComponent implements OnInit {
  rows: EditableRow[] = [];
  workshops: MaintenanceWorkshop[] = [];
  loading = true;
  loadError: string | null = null;
  saveError: string | null = null;

  addingNew = false;
  newDraft: Draft = { ...EMPTY_DRAFT };
  saving = false;

  constructor(
    private lookupsService: LookupsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.lookupsService.listMaintenanceWorkshops().subscribe({
      next: (workshops) => (this.workshops = workshops),
      error: () => {}, // non-fatal — the workshop dropdown just has nothing to offer
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadError = null;

    this.lookupsService.listGarageLocations().subscribe({
      next: (rows) => {
        this.rows = rows;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load garage locations.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  workshopName(workshopId: string | null): string {
    if (!workshopId) return '—';
    const w = this.workshops.find((w) => w.id === workshopId);
    return w ? w.name_en || w.name_ar : '—';
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
    if (!this.newDraft.garage_name.trim() || !this.newDraft.zone_label.trim()) {
      this.saveError = 'Garage name and zone label are required.';
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .createGarageLocation({
        garage_name: this.newDraft.garage_name.trim(),
        workshop_id: this.newDraft.workshop_id || null,
        zone_label: this.newDraft.zone_label.trim(),
        notes: this.newDraft.notes.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.addingNew = false;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err instanceof Error ? err.message : 'Failed to add garage location.';
        },
      });
  }

  startEdit(row: EditableRow): void {
    row._draft = {
      garage_name: row.garage_name,
      workshop_id: row.workshop_id,
      zone_label: row.zone_label,
      notes: row.notes || '',
    };
    this.saveError = null;
  }

  cancelEdit(row: EditableRow): void {
    delete row._draft;
  }

  confirmEdit(row: EditableRow): void {
    if (!row._draft) return;
    if (!row._draft.garage_name.trim() || !row._draft.zone_label.trim()) {
      this.saveError = 'Garage name and zone label are required.';
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .updateGarageLocation(row.id, {
        garage_name: row._draft.garage_name.trim(),
        workshop_id: row._draft.workshop_id || null,
        zone_label: row._draft.zone_label.trim(),
        notes: row._draft.notes.trim() || null,
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
