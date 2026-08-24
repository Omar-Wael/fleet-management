import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ChangeDetectionStrategy} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { SparePartsService } from '../../../core/services/spare-parts.service';
import { SparePart } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-spare-part-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './spare-part-form.component.html',
  styleUrls: ['./spare-part-form.component.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SparePartFormComponent implements OnChanges {
  @Input() open = false;
  /** null = add mode, otherwise editing this part. */
  @Input() part: SparePart | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<SparePart>();

  form: FormGroup;

  saving = false;
  saveError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private sparePartsService: SparePartsService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.buildForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['part'] || (changes['open'] && this.open)) {
      this.patchFormFromPart();
    }
  }

  get isEditMode(): boolean {
    return !!this.part;
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      part_code: [null],
      name_ar: ['', Validators.required],
      name_en: [null],
      unit: [null],
      unit_cost: [null],
      current_stock_qty: [0, Validators.required],
      reorder_threshold: [null],
    });
  }

  private patchFormFromPart(): void {
    this.saveError = null;
    if (this.part) {
      this.form.reset({
        part_code: this.part.part_code,
        name_ar: this.part.name_ar,
        name_en: this.part.name_en,
        unit: this.part.unit,
        unit_cost: this.part.unit_cost,
        current_stock_qty: this.part.current_stock_qty,
        reorder_threshold: this.part.reorder_threshold,
      });
    } else {
      this.form.reset({ current_stock_qty: 0 });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.saveError = null;
    const payload: Partial<SparePart> = this.form.value;

    const request$ = this.isEditMode
      ? this.sparePartsService.update(this.part!.id, payload)
      : this.sparePartsService.create(payload);

    request$.subscribe({
      next: (savedPart) => {
        this.saving = false;
        this.saved.emit(savedPart);
        this.close();
      },
      error: (err) => {
        this.saving = false;
        this.saveError = err instanceof Error ? err.message : this.i18n.t('spareParts.partForm.saveError');
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
