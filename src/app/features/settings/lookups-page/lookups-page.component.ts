import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-lookups-page',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './lookups-page.component.html',
  styleUrls: ['./lookups-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LookupsPageComponent {}
