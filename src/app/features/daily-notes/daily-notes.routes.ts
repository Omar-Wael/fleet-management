import { Routes } from '@angular/router';
import { DailyNotesListComponent } from './daily-notes-list/daily-notes-list.component';

export const DAILY_NOTES_ROUTES: Routes = [
  {
    path: '',
    component: DailyNotesListComponent,
  },
];
