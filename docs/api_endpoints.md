# API Endpoints

Base URL: `http://localhost:8000/api`

## Salud

- `GET /health/`
  - Respuesta: estado de la API.

## Catalogo y POS

- `GET /catalogo/`
  - Retorna productos agrupados por tipo y lista de mesas.

- `POST /pedidos/`
  - Crea pedido y ticket QR.
  - Body:

```json
{
  "mesa_id": 1,
  "items": [
    { "producto_id": 1, "cantidad": 2 },
    { "producto_id": 8, "cantidad": 1 }
  ]
}
```

- `GET /pedidos/{pedido_id}/`
  - Detalle del pedido.

- `GET /pedidos/historial/?folio=&estado=&fecha_desde=YYYY-MM-DD&fecha_hasta=YYYY-MM-DD`
  - Historial de pedidos con filtros por folio, estado y rango de fechas.

## Produccion

- `GET /produccion/tablero/`
  - KPIs y ordenes activas (`pendiente`, `en_horno`, `listo`).

- `GET /pedidos/{pedido_id}/requerimientos/`
  - Insumos requeridos para el pedido.

- `POST /pedidos/{pedido_id}/confirmar-insumos/`
  - Descuenta inventario y marca `insumos_confirmados=true`.

- `POST /pedidos/{pedido_id}/estado/`
  - Cambia estado del pedido.
  - Body:

```json
{
  "estado": "en_horno"
}
```

Estados validos:
- `pendiente`
- `en_horno`
- `listo`

## Ticket

- `GET /tickets/{folio}/`
  - Ticket completo por folio (detalle, totales, QR).

## Mesas

- `POST /mesas/{mesa_id}/liberar/`
  - Cambia mesa a estado `libre`.

## Inventario

- `GET /inventario/ingredientes/`
  - Lista ingredientes y alerta de stock bajo.

- `POST /inventario/entradas/`
  - Registra reposicion de inventario.
  - Body:

```json
{
  "ingrediente_id": 2,
  "cantidad": 5,
  "observacion": "Compra semanal"
}
```

- `GET /inventario/movimientos/`
  - Historial reciente de entradas/salidas.

## Reportes

- `GET /reportes/top-productos/?periodo=todo`

Valores `periodo`:
- `hoy`
- `semana`
- `mes`
- `todo`
