# Flujo funcional por rol

## 1) Caja / Recepcion

1. Abrir pantalla POS (`/`).
2. Elegir mesa.
3. Agregar productos al carrito por categoria.
4. Confirmar pago.
5. Obtener ticket digital con QR.

Resultado:
- Se crea pedido en estado `pendiente`.
- Se marca mesa como `ocupada`.
- Se genera ticket con folio y QR.

## 2) Cocina / Produccion

1. Abrir tablero (`/produccion`).
2. Revisar pedidos urgentes (`pendiente`).
3. Confirmar salida de insumos.
4. Cambiar estado a `en_horno`.
5. Cambiar estado a `listo` al terminar.

Resultado:
- Inventario baja de acuerdo con recetas.
- Queda trazabilidad en `MovimientoInventario`.

## 3) Admin

1. Abrir panel (`/admin-panel`).
2. Consultar top de productos por periodo.
3. Revisar alertas de stock minimo.
4. Registrar entradas de materia prima.
5. Validar movimientos historicos.

Resultado:
- Control basico de operacion y reposicion.

## Recomendaciones para entrega escolar

- Mostrar el flujo de punta a punta en demo:
  1. Crear pedido
  2. Ver ticket QR
  3. Confirmar insumos en cocina
  4. Ver impacto en inventario/admin
- Llevar impresa la tabla de estados y reglas de negocio.