import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Producto } from '../models/producto';
import { Pedido, PedidoRequest } from '../models/pedido';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = '/api';

  constructor(private http: HttpClient) { }

  getMenu(): Observable<Producto[]> {
    return this.http.get<Producto[]>(`${this.baseUrl}/menu`);
  }

  crearPedido(pedido: PedidoRequest): Observable<Pedido> {
    return this.http.post<Pedido>(`${this.baseUrl}/pedidos`, pedido);
  }
}