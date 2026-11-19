import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { timeout } from 'rxjs';
import { AdminPedidosComponent } from './pages/admin-pedidos/admin-pedidos';
import { environment } from '../environments/environment';

export interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
  disponible?: boolean;
}

interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

interface PedidoRequestPayload {
  clienteNombre: string;
  telefono: string;
  tipoEntrega: 'Recoger' | 'Domicilio';
  direccion: string;
  items: { productoId: number; cantidad: number }[];
}

interface PedidoCreadoResponse {
  id: number;
  total: number;
  estatus: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminPedidosComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private menuUrl = `${environment.apiUrl}/api/menu`;
  private pedidosUrl = `${environment.apiUrl}/api/pedidos`;

  vista: 'menu' | 'admin' = 'menu';

  negocio = {
    nombre: 'Tortería El Chavo',
    direccion: 'Calle 10 de Abril, No. 7, San Juan Raboso',
    telefonos: ['243-126-1277', '243-436-5047'],
    whatsapp: '522431261277'
  };

  productos: Producto[] = [];
  categoriaSeleccionada = 'Todas';
  cargando = true;
  errorCarga = '';

  carrito: ItemCarrito[] = [];
  clienteNombre = '';
  telefono = '';
  tipoEntrega: 'Recoger' | 'Domicilio' = 'Recoger';
  direccion = '';
  notas = '';

  enviandoPedido = false;
  errorPedido = '';

  ngOnInit(): void {
    this.cargarMenu();
  }

  cargarMenu() {
    this.cargando = true;
    this.errorCarga = '';

    this.http.get<Producto[]>(this.menuUrl)
      .pipe(timeout(6000))
      .subscribe({
        next: (data) => {
          this.productos = Array.isArray(data)
            ? data.filter(p => p.disponible !== false)
            : [];
          this.cargando = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al cargar el menú:', err);
          this.errorCarga = 'No se pudo cargar el menú desde http://localhost:8080/api/menu.';
          this.cargando = false;
          this.cdr.detectChanges();
        }
      });
  }

  get categorias(): string[] {
    const unicas = new Set(this.productos.map(p => p.categoria));
    return ['Todas', ...Array.from(unicas)];
  }

  get productosFiltrados(): Producto[] {
    if (this.categoriaSeleccionada === 'Todas') return this.productos;
    return this.productos.filter(p => p.categoria === this.categoriaSeleccionada);
  }

  agregar(producto: Producto) {
    const existente = this.carrito.find(i => i.producto.id === producto.id);
    if (existente) {
      existente.cantidad++;
    } else {
      this.carrito.push({ producto, cantidad: 1 });
    }
  }

  restar(productoId: number) {
    const item = this.carrito.find(i => i.producto.id === productoId);
    if (!item) return;
    item.cantidad--;
    if (item.cantidad <= 0) {
      this.carrito = this.carrito.filter(i => i.producto.id !== productoId);
    }
  }

  get total(): number {
    return this.carrito.reduce((acc, i) => acc + i.producto.precio * i.cantidad, 0);
  }

  confirmarYEnviarWhatsApp() {
    if (this.carrito.length === 0 || this.enviandoPedido) return;

    this.errorPedido = '';
    this.enviandoPedido = true;

    const snapshotCarrito = [...this.carrito];
    const snapshotTotal = this.total;
    const snapshotNombre = this.clienteNombre.trim();
    const snapshotTelefono = this.telefono.trim();
    const snapshotTipo = this.tipoEntrega;
    const snapshotDireccion = this.direccion.trim();
    const snapshotNotas = this.notas.trim();

    const payload: PedidoRequestPayload = {
      clienteNombre: snapshotNombre || 'Cliente mostrador',
      telefono: snapshotTelefono,
      tipoEntrega: snapshotTipo,
      direccion: snapshotTipo === 'Domicilio' ? snapshotDireccion : this.negocio.direccion,
      items: snapshotCarrito.map(i => ({
        productoId: i.producto.id,
        cantidad: i.cantidad
      }))
    };

    this.http.post<PedidoCreadoResponse>(this.pedidosUrl, payload)
      .pipe(timeout(8000))
      .subscribe({
        next: (pedidoGuardado) => {
          this.enviandoPedido = false;
          this.carrito = [];
          this.clienteNombre = '';
          this.telefono = '';
          this.direccion = '';
          this.notas = '';

          const lineas = snapshotCarrito.map(
            i => `• ${i.cantidad}x ${i.producto.nombre} - $${(i.producto.precio * i.cantidad).toFixed(2)}`
          );

          const detallesCliente = [
            `*Folio:* #${pedidoGuardado.id}`,
            snapshotNombre ? `*Cliente:* ${snapshotNombre}` : '',
            snapshotTelefono ? `*Teléfono:* ${snapshotTelefono}` : '',
            `*Entrega:* ${snapshotTipo === 'Domicilio' ? 'Servicio a domicilio' : 'Recoger en local'}`,
            snapshotTipo === 'Domicilio' && snapshotDireccion ? `*Dirección:* ${snapshotDireccion}` : '',
            snapshotNotas ? `*Notas:* ${snapshotNotas}` : ''
          ].filter(Boolean);

          const mensaje = [
            `¡Hola *${this.negocio.nombre}*! Quiero hacer este pedido:`,
            '',
            ...lineas,
            '',
            `*Total: $${(pedidoGuardado.total ?? snapshotTotal).toFixed(2)}*`,
            ...(detallesCliente.length ? ['', ...detallesCliente] : [])
          ].join('\n');

          this.cdr.detectChanges();
          const url = `https://wa.me/${this.negocio.whatsapp}?text=${encodeURIComponent(mensaje)}`;
          window.open(url, '_blank');
        },
        error: (err) => {
          console.error('Error al guardar pedido:', err);
          this.enviandoPedido = false;
          this.errorPedido = err?.error?.message || 'No se pudo guardar el pedido en el servidor.';
          this.cdr.detectChanges();
        }
      });
  }
}