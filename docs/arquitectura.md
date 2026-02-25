# Arquitectura del sistema

## Resumen

El sistema se divide en dos capas:

1. Backend `Django REST`
- Exponer endpoints para POS, produccion, inventario y reportes.
- Aplicar reglas de negocio de pedidos e inventario.
- Persistir informacion en SQLite.

2. Frontend `React + Vite`
- UI para roles escolares: caja, cocina y admin.
- Consumir la API via Axios.
- Mantener experiencia similar a referencias de pantallas.

## Modelo de datos principal

Entidades base:
- `Mesa`: numero y estado (`libre`, `ocupada`).
- `Producto`: pizzas, bebidas, postres y combos.
- `Pedido`: folio, estado, subtotal, impuesto, total, mesa.
- `DetallePedido`: productos del pedido con cantidad y subtotales.
- `Ticket`: QR y URL de ticket digital.
- `Ingrediente`: stock actual/minimo.
- `RecetaProducto`: consumo de ingredientes por producto.
- `MovimientoInventario`: entradas y salidas con trazabilidad.

## Componentes backend

- `models.py`: entidades y relaciones.
- `services.py`:
  - creacion de pedido
  - calculo de requerimientos de insumos
  - confirmacion/descuento de inventario
  - validacion de cambios de estado
- `views.py`: endpoints REST.
- `management/commands/seed_data.py`: carga inicial.

## Componentes frontend

- `pages/PosPage.jsx`: flujo de venta.
- `pages/TicketPage.jsx`: confirmacion de pago + QR.
- `pages/ProductionPage.jsx`: tablero cocina y acciones.
- `pages/AdminPage.jsx`: inventario y reporte.
- `components/*`: tabs, cards, sidebar y badges.

## Consideraciones

- Proyecto enfocado en uso escolar local.
- Seguridad simplificada (sin auth obligatoria).
- Puede extenderse a JWT, permisos por rol y WebSockets para tiempo real.