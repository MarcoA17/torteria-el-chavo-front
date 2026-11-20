import { Component, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { retry, timer, timeout, Subscription, interval, switchMap, catchError, of } from 'rxjs';
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
export class App implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private menuUrl = `${environment.apiUrl}/api/menu`;
  private pedidosUrl = `${environment.apiUrl}/api/pedidos`;
  private keepAliveSub?: Subscription;

  vista: 'menu' | 'admin' | 'seguimiento' = 'menu';
  esAdminAutenticado = false;
  mostrarModalPin = false;
  pinIngresado = '';
  errorPin = '';
  // Cámbialo por el PIN que prefiera el dueño del negocio
  private readonly PIN_ADMIN = '1971';

  ngOnInit(): void {
    this.cargarMenu();
    this.iniciarKeepAlive();

    // Si entran con ?admin=1 en la URL, abre el cuadro de PIN
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1') {
      this.mostrarModalPin = true;
    }

    // Recuperar el último folio guardado en el navegador del cliente
    const ultimoFolio = localStorage.getItem('ultimoFolioChavo');
    if (ultimoFolio) {
      this.folioConsulta = Number(ultimoFolio);
    }
  }

  private iniciarKeepAlive(): void {
    // Ping silencioso cada 10 minutos mientras la app esté abierta
    this.keepAliveSub = interval(10 * 60 * 1000)
      .pipe(
        switchMap(() =>
          this.http.get<Producto[]>(this.menuUrl).pipe(
            catchError(() => of(null))
          )
        )
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.keepAliveSub?.unsubscribe();
  }

  folioConsulta: number | null = null;
  pedidoConsultado: any = null;
  consultandoFolio = false;
  errorConsultaFolio = '';

  consultarEstatusPedido() {
    if (!this.folioConsulta) return;
    this.consultandoFolio = true;
    this.errorConsultaFolio = '';

    this.http.get<any[]>(this.pedidosUrl)
      .pipe(timeout(45000))
      .subscribe({
        next: (lista) => {
          const encontrado = lista.find(p => p.id === Number(this.folioConsulta));
          if (encontrado) {
            this.pedidoConsultado = encontrado;
          } else {
            this.pedidoConsultado = null;
            this.errorConsultaFolio = `No encontramos el Folio #${this.folioConsulta}.`;
          }
          this.consultandoFolio = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.errorConsultaFolio = 'No se pudo consultar el estatus en este momento.';
          this.consultandoFolio = false;
          this.cdr.detectChanges();
        }
      });
  }

  irASeguimiento() {
    this.vista = 'seguimiento';
    if (this.folioConsulta) {
      this.consultarEstatusPedido();
    }
  }

  abrirAccesoAdmin() {
    if (this.esAdminAutenticado) {
      this.vista = 'admin';
    } else {
      this.pinIngresado = '';
      this.errorPin = '';
      this.mostrarModalPin = true;
    }
  }

  verificarPin() {
    if (this.pinIngresado === this.PIN_ADMIN) {
      this.esAdminAutenticado = true;
      this.mostrarModalPin = false;
      this.vista = 'admin';
    } else {
      this.errorPin = 'PIN incorrecto';
    }
  }

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

  cargarMenu() {
    this.cargando = true;
    this.errorCarga = '';

    this.http.get<Producto[]>(this.menuUrl)
      .pipe(
        timeout(50000),
        retry({
          count: 2,
          delay: (error, retryCount) => {
            console.log(`Reintentando cargar menú (${retryCount})...`);
            return timer(4000);
          }
        })
      )
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
          this.errorCarga = `No se pudo cargar el menú desde ${this.menuUrl}. El servidor podría estar despertando; intenta de nuevo en unos segundos.`;
          this.cargando = false;
          this.cdr.detectChanges();
        }
      });
  }

  get categorias(): string[] {
    const unicas = new Set(this.productos.map(p => p.categoria));
    return ['Todas', ...Array.from(unicas)];
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
    const mensajeError = this.validarFormularioPedido();
    if (mensajeError) {
      this.errorPedido = mensajeError;
      return;
    }
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
      .pipe(timeout(45000))
      .subscribe({
        next: (pedidoGuardado) => {
          this.enviandoPedido = false;
          this.carrito = [];
          this.clienteNombre = '';
          this.telefono = '';
          this.direccion = '';
          this.notas = '';

          localStorage.setItem('ultimoFolioChavo', String(pedidoGuardado.id));
          this.folioConsulta = pedidoGuardado.id;
          this.pedidoConsultado = pedidoGuardado;
          this.vista = 'seguimiento';

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

  private validarFormularioPedido(): string | null {
    if (this.carrito.length === 0) {
      return 'Agrega al menos un producto a tu canasta.';
    }

    const nombreLimpio = this.clienteNombre.trim();
    if (nombreLimpio.length < 2) {
      return 'Por favor escribe tu nombre para identificar tu orden.';
    }

    const telefonoLimpio = this.telefono.replace(/\D/g, '');
    if (telefonoLimpio.length !== 10) {
      return 'Ingresa un teléfono válido de 10 dígitos (ej. 2431261277).';
    }

    if (this.tipoEntrega === 'Domicilio' && this.direccion.trim().length < 5) {
      return 'Ingresa tu dirección completa para el servicio a domicilio.';
    }

    return null;
  }

  // Paginación del menú
  paginaActual = 1;
  tamanoPagina = 6; // Ajusta a 4 o 6 según qué tan altas sean tus tarjetas en móvil

  // Cambia de categoría y regresa a la página 1
  seleccionarCategoria(cat: string): void {
    this.categoriaSeleccionada = cat;
    this.paginaActual = 1;
  }

  // Productos filtrados (sin paginar)
  get productosFiltrados(): Producto[] {
    if (this.categoriaSeleccionada === 'Todas') return this.productos;
    return this.productos.filter(p => p.categoria === this.categoriaSeleccionada);
  }

  // Solo paginamos cuando estamos en 'Todas' para acortar el scroll en celular
  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.productosFiltrados.length / this.tamanoPagina));
  }

  get productosVisibles(): Producto[] {
    const lista = this.productosFiltrados;
    const inicio = (this.paginaActual - 1) * this.tamanoPagina;
    return lista.slice(inicio, inicio + this.tamanoPagina);
  }

  irAPagina(pagina: number): void {
    const destino = Math.min(Math.max(1, pagina), this.totalPaginas);
    this.paginaActual = destino;
  }

}