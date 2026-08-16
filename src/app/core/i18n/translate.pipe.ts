import { Pipe, PipeTransform } from '@angular/core';
import { TranslationService } from './translation.service';

/**
 * `{{ 'common.save' | translate }}` — impure by design (`pure: false`) so
 * it re-runs on every change-detection pass rather than only when its
 * input string changes. A plain pure pipe would cache the first render's
 * output and never re-translate when the language toggles, since the key
 * argument itself doesn't change — same reason ngx-translate's own pipe
 * is impure.
 */
@Pipe({ name: 'translate', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  constructor(private i18n: TranslationService) {}

  transform(key: string | null | undefined): string {
    if (!key) return '';
    return this.i18n.t(key);
  }
}
