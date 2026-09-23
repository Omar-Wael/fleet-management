import { Routes } from '@angular/router';
import { UsersListComponent } from './users-list/users-list.component';
import { RolesListComponent } from './roles-list/roles-list.component';

export const USERS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'list' },
  { path: 'list', component: UsersListComponent, title: 'Users' },
  { path: 'roles', component: RolesListComponent, title: 'Roles' },
];
