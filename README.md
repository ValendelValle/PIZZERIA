# Pizzeria POS Escolar (Django + React + Vite)

Proyecto escolar full-stack para pizzeria con:
- POS de caja/recepcion.
- Tablero de produccion.
- Ticket digital con QR.
- Inventario de materia prima (entradas/salidas).
- Reporte basico de productos mas vendidos.

La implementacion se baso en:
- `diagrama_ER_simple.mermaid`
- `REQUISITOS metodologias.docx`

## 1. Stack tecnologico

- Backend: Django + Django REST Framework + SQLite
- Frontend: React + Vite + React Router + Axios
- Utilidades: `qrcode` para generar QR en base64

## 2. Estructura del proyecto

```text
PIZZERIA/
+- backend/
¦  +- apps/pos/               # modelos, API, logica de negocio, seed
¦  +- config/                 # settings, urls, asgi, wsgi
¦  +- manage.py
¦  +- requirements.txt
+- frontend/
¦  +- src/
¦  ¦  +- api/                 # cliente HTTP
¦  ¦  +- components/          # componentes UI reutilizables
¦  ¦  +- pages/               # pantallas (POS, Ticket, Produccion, Admin)
¦  ¦  +- styles/              # estilos globales
¦  ¦  +- utils/
¦  +- package.json
¦  +- vite.config.js
+- docs/
   +- arquitectura.md
   +- api_endpoints.md
   +- flujo_funcional.md
```

## 3. Instalacion y ejecucion

### 3.1 Backend (Django)

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

API base: `http://localhost:8000/api`

### 3.2 Frontend (React + Vite)

```bash
cd frontend
copy .env.example .env    # Windows
# cp .env.example .env    # Linux/Mac

npm install
npm run dev
```

Frontend: `http://localhost:5173`

## 4. Usuarios de prueba (seed)

Se crean con `python manage.py seed_data`:

- Usuario: `cajero` / Password: `cajero123`
- Usuario: `cocina` / Password: `cocina123`
- Usuario: `admin` / Password: `admin123`

> Nota: En esta version escolar la API se deja abierta sin login para simplificar pruebas.

## 5. Flujo rapido de uso

1. Ir a POS (`/`).
2. Seleccionar mesa y productos.
3. Presionar **Completar pago**.
4. Ver ticket con QR en `/ticket/<folio>`.
5. Ir a Produccion (`/produccion`) para:
   - Confirmar insumos.
   - Cambiar estado a `en_horno`.
   - Cambiar estado a `listo`.
6. Ir a Admin (`/admin-panel`) para:
   - Ver top de productos.
   - Registrar entradas de inventario.
   - Revisar alertas de stock y movimientos.

## 6. Reglas funcionales implementadas

- El pedido se crea con folio unico y ticket digital QR.
- El total se calcula como:
  - `subtotal = suma(detalles)`
  - `impuesto = subtotal * 0.16`
  - `total = subtotal + impuesto`
- La mesa seleccionada pasa a estado `ocupada` al crear pedido.
- Cocina debe **confirmar insumos** antes de mover un pedido a `en_horno`.
- Al confirmar insumos se descuenta inventario y se registra movimiento tipo `salida`.
- Se pueden registrar movimientos de `entrada` desde el panel admin.
- Se muestran alertas por stock bajo (`stock_actual <= stock_minimo`).

## 7. Verificaciones realizadas

- Backend:
  - `python manage.py check` OK
  - `python manage.py migrate` OK
  - Flujo API probado: crear pedido, ticket por folio, confirmar insumos, cambios de estado
- Frontend:
  - `npm run build` OK

## 8. Documentacion adicional

- Arquitectura: [docs/arquitectura.md](docs/arquitectura.md)
- Endpoints: [docs/api_endpoints.md](docs/api_endpoints.md)
- Flujo por rol: [docs/flujo_funcional.md](docs/flujo_funcional.md)