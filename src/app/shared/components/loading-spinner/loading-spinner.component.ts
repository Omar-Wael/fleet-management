import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/**
 * Reusable loading spinner.
 *
 * Modes:
 * - `overlay` (default false): full-area semi-transparent overlay over the parent
 *   (parent should be `position: relative`). Use for page/section blocking.
 * - `fullscreen`: covers the entire viewport (fixed).
 * - plain: inline spinner + optional message (no backdrop).
 */
@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './loading-spinner.component.html',
  styleUrl: './loading-spinner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedLoadingSpinnerComponent {
  /** Show as overlay on the nearest positioned parent. */
  @Input() overlay = false;

  /** Cover the full viewport (ignores parent bounds). */
  @Input() fullscreen = false;

  /** Optional message under the spinner. Pass a translation key or plain text. */
  @Input() message: string | null = null;

  /** When true, `message` is treated as an i18n key and piped through translate. */
  @Input() translateMessage = true;

  /** Visual size of the ring. */
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
}
