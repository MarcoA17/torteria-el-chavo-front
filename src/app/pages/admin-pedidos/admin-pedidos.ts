import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

interface ItemPedidoDetalle {
  id: number;
  productoId: number;
  cantidad: number;
  precioUnitario: number;
}

interface PedidoAdmin {
  id: number;
  clienteNombre: string;
  telefono: string;
  tipoEntrega: string;
  direccion: string;
  total: number;
  estatus: 'PENDIENTE' | 'EN_PREPARACION' | 'ENTREGADO' | 'CANCELADO' | string;
  createdAt: string;
  items: ItemPedidoDetalle[];
}

interface ProductoMenu {
  id: number;
  nombre: string;
}

@Component({
  selector: 'app-admin-pedidos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-pedidos.html',
  styleUrl: './admin-pedidos.css'
})
export class AdminPedidosComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  private pedidosUrl = `${environment.apiUrl}/api/pedidos`;
  private menuUrl = `${environment.apiUrl}/api/menu`;

  pedidos: PedidoAdmin[] = [];
  nombresProductos: Record<number, string> = {};
  filtroEstatus = 'TODOS';
  estatusOpciones = ['PENDIENTE', 'EN_PREPARACION', 'ENTREGADO', 'CANCELADO'];

  cargando = true;
  errorMensaje = '';
  actualizandoId: number | null = null;

  ngOnInit(): void {
    this.cargarProductos();
    this.cargarPedidos();
  }

  cargarProductos() {
    this.http.get<ProductoMenu[]>(this.menuUrl)
      .pipe(timeout(6000))
      .subscribe({
        next: (productos) => {
          if (Array.isArray(productos)) {
            this.nombresProductos = productos.reduce((acc, p) => {
              acc[p.id] = p.nombre;
              return acc;
            }, {} as Record<number, string>);
            this.cdr.detectChanges();
          }
        },
        error: (err) => console.error('No se pudieron cargar nombres de productos:', err)
      });
  }

  cargarPedidos() {
    this.cargando = true;
    this.errorMensaje = '';

    this.http.get<PedidoAdmin[]>(this.pedidosUrl)
      .pipe(timeout(6000))
      .subscribe({
        next: (data) => {
          (data.sort((a, b) => b.id - a.id))
          this.pedidos = Array.isArray(data) ? data : [];
          this.cargando = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al cargar pedidos:', err);
          this.errorMensaje = 'No se pudieron cargar los pedidos desde el backend.';
          this.cargando = false;
          this.cdr.detectChanges();
        }
      });
  }

  get pedidosFiltrados(): PedidoAdmin[] {
    if (this.filtroEstatus === 'TODOS') return this.pedidos;
    return this.pedidos.filter(p => p.estatus === this.filtroEstatus);
  }

  nombreProducto(productoId: number): string {
    return this.nombresProductos[productoId] || `Producto #${productoId}`;
  }

  cambiarEstatus(pedidoId: number, nuevoEstatus: string) {
    this.actualizandoId = pedidoId;
    this.errorMensaje = '';

    this.http.patch<PedidoAdmin>(`${this.pedidosUrl}/${pedidoId}/estatus`, { estatus: nuevoEstatus })
      .pipe(timeout(6000))
      .subscribe({
        next: (actualizado) => {
          this.pedidos = this.pedidos.map(p => p.id === pedidoId ? actualizado : p);
          this.actualizandoId = null;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al actualizar estatus:', err);
          this.errorMensaje = err?.error?.message || 'No se pudo actualizar el estatus.';
          this.actualizandoId = null;
          this.cdr.detectChanges();
        }
      });
  }
}