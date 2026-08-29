import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-spare-parts-page',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './spare-parts-page.component.html',
  styleUrls: ['./spare-parts-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SparePartsPageComponent {}
