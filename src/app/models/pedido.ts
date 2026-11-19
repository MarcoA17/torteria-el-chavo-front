export interface ItemPedido {
  productoId: number;
  cantidad: number;
}

export interface PedidoRequest {
  clienteNombre: string;
  telefono: string;
  tipoEntrega: string;
  direccion: string;
  items: ItemPedido[];
}

export interface Pedido extends PedidoRequest {
  id: number;
  total: number;
  estatus: string;
  createdAt: string;
}