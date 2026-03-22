# Arquitectura del sistema

## Resumen

1. Frontend publico (`/`): autoservicio para cliente final.
2. Frontend staff (`/staff/login`, `/produccion`, `/admin-panel`): operacion interna por rol.
3. Backend Django REST: reglas de negocio, permisos por rol y persistencia.

## Roles

- Cliente final: sin autenticacion, solo puede ordenar y consultar ticket por QR.
- `produccion`: tablero de cocina y estados de pedidos.
- `admin`: control total (inventario, reportes, CRUD catalogos y mesas).

## Modelo de datos

- `Mesa`, `Producto`, `Pedido`, `DetallePedido`, `Ticket`
- `Ingrediente`, `RecetaProducto`, `MovimientoInventario`
- `UsuarioPerfil` (solo staff interno)
- `AdminAccion` (bitacora para hacer/deshacer en panel admin)

## Backend

- `services.py`: creacion de pedido, QR, insumos, estados.
- `permissions.py`: permisos por rol staff.
- `views.py`: endpoints publicos, protegidos, dashboard admin y deshacer.

## Frontend

- `PosPage.jsx`: modulo publico de ordenes.
- `TicketPage.jsx`: ticket digital con QR.
- `LoginPage.jsx`: acceso staff.
- `ProductionPage.jsx`: cocina.
- `AdminPage.jsx`: admin + CRUD.

## Consideraciones clave

- Pagos simulados.
- Ticket digital para reducir impresion.
- La seleccion de mesa valida disponibilidad y soporta opcion para llevar.
