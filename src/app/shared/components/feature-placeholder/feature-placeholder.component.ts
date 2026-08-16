import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/**
 * Temporary stand-in for any tab not yet built. Routed via `data: { title }`
 * (see app.routes.ts) rather than one placeholder per feature file, so
 * swapping in the real component later is a one-line change in the route
 * config — nothing else has to move.
 */
@Component({
  selector: 'app-feature-placeholder',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="placeholder">
      <p class="placeholder-eyebrow">{{ 'shared.featurePlaceholder.eyebrow' | translate }}</p>
      <h2 class="placeholder-title">{{ title }}</h2>
      <p class="placeholder-copy">
        {{ 'shared.featurePlaceholder.copyPrefix' | translate
        }}<code>{{ serviceHint || 'see fleet-services/services' }}</code
        >{{ 'shared.featurePlaceholder.copySuffix' | translate }}
      </p>
    </div>
  `,
  styles: [`
    .placeholder {
      max-width: 640px;
      margin: 3rem auto;
      padding: 2rem;
      text-align: center;
      border: 1px dashed var(--fleet-line, #dfe3e8);
      border-radius: 0.75rem;
      color: var(--fleet-ink-muted, #5b6472);
    }
    .placeholder-eyebrow {
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin: 0 0 0.5rem;
    }
    .placeholder-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--fleet-ink, #1f2430);
      margin: 0 0 0.75rem;
    }
    .placeholder-copy {
      font-size: 0.875rem;
      margin: 0;
    }
    code {
      font-family: var(--fleet-font-mono, 'IBM Plex Mono', monospace);
      background: rgba(0, 0, 0, 0.05);
      padding: 0.1rem 0.35rem;
      border-radius: 0.25rem;
    }
  `],
})
export class FeaturePlaceholderComponent {
  @Input() title = '';
  @Input() serviceHint = '';
}
