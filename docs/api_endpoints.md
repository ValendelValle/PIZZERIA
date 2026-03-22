# API Endpoints

Base URL: `http://localhost:8000/api`

Auth staff: token via `Authorization: Token <token>`.

## Publicos (cliente final)

- `GET /health/`
- `GET /catalogo/`
- `POST /pedidos/`
- `GET /tickets/{folio}/`

`POST /pedidos/` ejemplo:

```json
{
  "mesa_id": 1,
  "items": [
    { "producto_id": 1, "cantidad": 2 },
    { "producto_id": 8, "cantidad": 1 }
  ]
}
```

Para llevar: enviar `"mesa_id": null`.

## Auth staff

- `POST /auth/login/`
- `GET /auth/me/`
- `POST /auth/logout/`

## Produccion (rol `produccion` o `admin`)

- `GET /produccion/tablero/`
- `GET /pedidos/{pedido_id}/`
- `GET /pedidos/historial/`
- `GET /pedidos/{pedido_id}/requerimientos/`
- `POST /pedidos/{pedido_id}/confirmar-insumos/`
- `POST /pedidos/{pedido_id}/estado/`
- `POST /mesas/{mesa_id}/liberar/`

## Admin (rol `admin`)

- `GET /admin/dashboard/`
- `GET /admin/acciones/?limite=35`
- `POST /admin/acciones/{accion_id}/deshacer/`
- `GET /inventario/ingredientes/`
- `POST /inventario/entradas/`
- `GET /inventario/movimientos/`
- `GET /reportes/top-productos/?periodo=hoy|semana|mes|todo`

### CRUD admin

- `GET/POST /admin/productos/`
- `GET/PATCH/DELETE /admin/productos/{producto_id}/`

- `GET/POST /admin/ingredientes/`
- `GET/PATCH/DELETE /admin/ingredientes/{ingrediente_id}/`

- `GET/POST /admin/mesas/`
- `GET/PATCH/DELETE /admin/mesas/{mesa_id}/`
