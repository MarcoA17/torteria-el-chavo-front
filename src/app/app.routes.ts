import { Routes } from '@angular/router';
import { MenuComponent } from './pages/menu/menu';
import { AdminPedidosComponent } from './pages/admin-pedidos/admin-pedidos';

export const routes: Routes = [
  { path: '', component: MenuComponent },
  { path: 'admin-pedidos', component: AdminPedidosComponent },
  { path: '**', redirectTo: '' }
];