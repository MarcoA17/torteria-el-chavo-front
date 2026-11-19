import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { Producto } from '../../models/producto';
import { PedidoRequest } from '../../models/pedido';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menu.html',
  styleUrl: './menu.css'
})
export class MenuComponent implements OnInit {
  productos: Producto[] = [];
  carrito: { producto: Producto, cantidad: number }[] = [];
  pedidoCreado: boolean = false;

  // Datos del formulario
  clienteNombre = '';
  telefono = '';
  tipoEntrega = 'DOMICILIO';
  direccion = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getMenu().subscribe(data => this.productos = data);
  }

  agregarAlCarrito(producto: Producto) {
    const item = this.carrito.find(c => c.producto.id === producto.id);
    if (item) {
      item.cantidad++;
    } else {
      this.carrito.push({ producto, cantidad: 1 });
    }
  }

  quitar(producto: Producto) {
    const index = this.carrito.findIndex(c => c.producto.id === producto.id);
    if (index >= 0) {
      if (this.carrito[index].cantidad > 1) {
        this.carrito[index].cantidad--;
      } else {
        this.carrito.splice(index, 1);
      }
    }
  }

  get total() {
    return this.carrito.reduce((sum, c) => sum + (c.producto.precio * c.cantidad), 0);
  }

  enviarPedido() {
    const request: PedidoRequest = {
      clienteNombre: this.clienteNombre,
      telefono: this.telefono,
      tipoEntrega: this.tipoEntrega,
      direccion: this.direccion,
      items: this.carrito.map(c => ({ productoId: c.producto.id, cantidad: c.cantidad }))
    };

    this.api.crearPedido(request).subscribe({
      next: () => {
        this.pedidoCreado = true;
        this.carrito = [];
        this.clienteNombre = '';
        this.telefono = '';
        this.direccion = '';
        setTimeout(() => this.pedidoCreado = false, 4000);
      },
      error: (err) => alert('Error al crear pedido: ' + err.error.message)
    });
  }
}