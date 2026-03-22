# Flujo funcional

## 1) Cliente final (publico)

1. Entrar a `/`.
2. Elegir tipo de pedido: `para llevar` o `consumir en mesa`.
3. Agregar productos al carrito.
4. Completar pago simulado.
5. Recibir ticket digital con QR en `/ticket/<folio>`.

Resultado:
- Se crea pedido en estado `pendiente`.
- Si eligio mesa, la mesa pasa a `ocupada`.
- El cliente puede escanear QR para ver su ticket sin imprimir.

## 2) Cocina (`produccion` o `admin`)

1. Entrar a `/staff/login`.
2. Abrir `/produccion`.
3. Confirmar insumos.
4. Cambiar estado a `en_horno` y luego `listo`.

Resultado:
- Se descuentan ingredientes segun receta.
- Se registran salidas en movimientos de inventario.

## 3) Administracion (`admin`)

1. Entrar a `/staff/login`.
2. Abrir `/admin-panel`.
3. Revisar dashboard con KPIs de operacion.
4. Gestionar CRUD de productos, ingredientes y mesas.
5. Registrar entradas de inventario.
6. Consultar historial de cambios y usar deshacer cuando sea necesario.

Resultado:
- Control operativo y mantenimiento completo del sistema.
- Trazabilidad de acciones administrativas y capacidad de revertir cambios.
