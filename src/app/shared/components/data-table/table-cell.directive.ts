import { Directive, Input, TemplateRef } from '@angular/core';

/**
 * Marks an `<ng-template appCellDef="columnKey" let-row>` as the cell
 * renderer for that column inside SharedDataTableComponent. Mirrors the
 * `matCellDef`/ngx-datatable column-template convention so custom cell
 * markup (badges, links, nested buttons) can be authored per-column
 * without the table component needing to know about any of it.
 */
@Directive({
  selector: '[appCellDef]',
  standalone: true,
})
export class TableCellDirective {
  @Input('appCellDef') columnKey = '';

  constructor(public readonly templateRef: TemplateRef<{ $implicit: any; row: any }>) {}
}
