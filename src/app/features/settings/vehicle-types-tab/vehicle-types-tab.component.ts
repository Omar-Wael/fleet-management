import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LookupsService } from '../../../core/services/lookups.service';
import { VehicleType } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

interface EditableRow extends VehicleType {
  _draft?: { name_ar: string; name_en: string; default_workshop_type: string };
}

const EMPTY_DRAFT = { name_ar: '', name_en: '', default_workshop_type: '' };

/**
 * Deliberately not the slide-over/detail-drawer pattern the rest of the
 * app uses for Vehicles/Engines/etc — this is a 3-field reference table
 * with no detail worth its own drawer, so it's a plain inline-editable
 * grid instead: click Edit, the row itself becomes inputs, Save/Cancel
 * right there. Simpler for something this small, and the same shape
 * reused across all four Lookups tabs.
 */
@Component({
  selector: 'app-vehicle-types-tab',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './vehicle-types-tab.component.html',
  styleUrls: ['./vehicle-types-tab.component.scss'],
})
export class VehicleTypesTabComponent implements OnInit {
  rows: EditableRow[] = [];
  loading = true;
  loadError: string | null = null;
  saveError: string | null = null;

  addingNew = false;
  newDraft = { ...EMPTY_DRAFT };
  saving = false;

  constructor(
    private lookupsService: LookupsService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadError = null;

    this.lookupsService.listVehicleTypes().subscribe({
      next: (rows) => {
        this.rows = rows;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('settings.vehicleTypes.loadError');
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
    if (!this.newDraft.name_ar.trim() || !this.newDraft.default_workshop_type.trim()) {
      this.saveError = this.i18n.t('settings.vehicleTypes.validationError');
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .createVehicleType({
        name_ar: this.newDraft.name_ar.trim(),
        name_en: this.newDraft.name_en.trim() || null,
        default_workshop_type: this.newDraft.default_workshop_type.trim(),
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.addingNew = false;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err instanceof Error ? err.message : this.i18n.t('settings.vehicleTypes.addError');
        },
      });
  }

  startEdit(row: EditableRow): void {
    row._draft = {
      name_ar: row.name_ar,
      name_en: row.name_en || '',
      default_workshop_type: row.default_workshop_type,
    };
    this.saveError = null;
  }

  cancelEdit(row: EditableRow): void {
    delete row._draft;
  }

  confirmEdit(row: EditableRow): void {
    if (!row._draft) return;
    if (!row._draft.name_ar.trim() || !row._draft.default_workshop_type.trim()) {
      this.saveError = this.i18n.t('settings.vehicleTypes.validationError');
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .updateVehicleType(row.id, {
        name_ar: row._draft.name_ar.trim(),
        name_en: row._draft.name_en.trim() || null,
        default_workshop_type: row._draft.default_workshop_type.trim(),
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err instanceof Error ? err.message : this.i18n.t('settings.vehicleTypes.saveError');
        },
      });
  }
}
