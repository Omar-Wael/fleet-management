import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  EntityImage,
  EntityImagesService,
  EntityImageType,
} from '../../../core/services/entity-images.service';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/**
 * Reusable image gallery + upload for vehicles, invoices, checks,
 * disbursement requests, and spare parts.
 *
 * Requires: migration 002 + Supabase Storage bucket `entity-images` (public).
 */
@Component({
  selector: 'app-entity-image-upload',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './entity-image-upload.component.html',
  styleUrls: ['./entity-image-upload.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityImageUploadComponent implements OnChanges {
  @Input() entityType!: EntityImageType;
  @Input() entityId: string | null = null;
  /** When false, only shows gallery (no upload). */
  @Input() editable = true;

  @Output() changed = new EventEmitter<void>();

  images: EntityImage[] = [];
  loading = false;
  uploading = false;
  error: string | null = null;

  constructor(
    private imagesService: EntityImagesService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['entityId'] || changes['entityType']) && this.entityId) {
      this.reload();
    }
  }

  reload(): void {
    if (!this.entityId) return;
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    this.imagesService.list(this.entityType, this.entityId).subscribe({
      next: (rows) => {
        this.images = rows;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = err instanceof Error ? err.message : 'Failed to load images';
        this.cdr.markForCheck();
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.entityId) return;

    this.uploading = true;
    this.error = null;
    this.cdr.markForCheck();
    const isPrimary = this.images.length === 0;
    this.imagesService.upload(this.entityType, this.entityId, file, { isPrimary }).subscribe({
      next: () => {
        this.uploading = false;
        this.reload();
        this.changed.emit();
      },
      error: (err) => {
        this.uploading = false;
        this.error = err instanceof Error ? err.message : 'Upload failed';
        this.cdr.markForCheck();
      },
    });
  }

  setPrimary(img: EntityImage): void {
    if (!this.entityId) return;
    this.imagesService.setPrimary(img.id, this.entityType, this.entityId).subscribe({
      next: () => {
        this.reload();
        this.changed.emit();
      },
    });
  }

  remove(img: EntityImage): void {
    if (!window.confirm(this.i18n.t('shared.images.confirmDelete'))) return;
    this.imagesService.delete(img).subscribe({
      next: () => {
        this.reload();
        this.changed.emit();
      },
      error: (err) => {
        this.error = err instanceof Error ? err.message : 'Delete failed';
        this.cdr.markForCheck();
      },
    });
  }
}
