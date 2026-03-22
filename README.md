# Pizzeria POS Escolar (Django + React + Vite)

Sistema de autoservicio para pizzeria:
- Cliente final (publico) puede ordenar, elegir mesa o para llevar y pagar de forma simulada.
- Se genera ticket digital con QR para evitar impresion.
- Staff interno: `produccion` y `admin`.
- Moneda mostrada en frontend: `MXN`.

## 1. Stack tecnologico

- Backend: Django + Django REST Framework + SQLite
- Frontend: React + Vite + React Router + Axios
- Utilidades: `qrcode` para generar QR en base64

## 2. Instalacion y ejecucion

### Backend

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

### Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## 3. Usuarios internos de prueba

Se crean con `python manage.py seed_data`:

- `cocina / cocina123` -> rol `produccion`
- `admin / admin123` -> rol `admin`

No existe usuario para cliente final porque el modulo de ordenes es publico.

## 4. Rutas de la app

- `/` -> modulo publico para ordenar (cliente final)
- `/ticket/<folio>` -> ticket QR publico
- `/staff/login` -> acceso interno
- `/produccion` -> panel cocina (requiere login rol `produccion` o `admin`)
- `/admin-panel` -> panel administrativo (requiere login rol `admin`)

## 5. Flujo principal

1. Cliente entra a `/`.
2. Elige `para llevar` o `consumir en mesa`.
3. Selecciona productos y confirma pago simulado.
4. Se crea pedido y ticket con QR.
5. Cocina procesa en `/produccion`.
6. Admin controla dashboard, inventario, reportes, CRUD y deshacer en `/admin-panel`.

## 6. Verificaciones

- Backend: `python manage.py migrate`, `python manage.py check`.
- Frontend: `npm run build`.
- API: login staff + permisos por rol + acceso publico a orden/ticket.
- Salud del sistema: `GET /api/health/` valida API y conexion a base de datos.

## 7. Documentacion

- [docs/api_endpoints.md](docs/api_endpoints.md)
- [docs/flujo_funcional.md](docs/flujo_funcional.md)
- [docs/arquitectura.md](docs/arquitectura.md)
