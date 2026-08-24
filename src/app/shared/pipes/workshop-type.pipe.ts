import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../../core/i18n/translation.service';

/**
 * Formats raw workshop_type enum values (e.g. light_transport)
 * into readable labels (Light Transport Workshop), with i18n when available.
 */
@Pipe({ name: 'workshopType', standalone: true, pure: true })
export class WorkshopTypePipe implements PipeTransform {
  private readonly i18n = inject(TranslationService);

  transform(value: string | null | undefined, suffixWorkshop = true): string {
    if (!value) return '—';
    const key = `workshopType.${value}`;
    const translated = this.i18n.t(key);
    if (translated !== key) return translated;

    const label = value
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    if (!suffixWorkshop) return label;
    // Avoid double "Workshop" if already present
    if (/workshop/i.test(label)) return label;
    return `${label} Workshop`;
  }
}
