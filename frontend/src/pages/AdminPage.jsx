import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  History,
  LayoutDashboard,
  PlusCircle,
  RotateCcw,
  Save,
  Trash2,
  RefreshCcw,
  Package,
} from 'lucide-react';
import client from '../api/client';
import PanelSidebar from '../components/PanelSidebar';
import { money } from '../utils/format';

const PRODUCT_TYPES = ['pizza', 'bebida', 'postre', 'combo'];
const MESA_STATES = ['libre', 'ocupada'];

const ADMIN_MODULES = [
  { key: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { key: 'inventario', label: 'Inventario', icon: Boxes },
  { key: 'catalogos', label: 'Catalogos', icon: Package },
  { key: 'auditoria', label: 'Auditoria', icon: History },
];

function parseApiError(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') {
    return detail;
  }

  const data = err?.response?.data;
  if (data && typeof data === 'object') {
    const firstKey = Object.keys(data)[0];
    const firstValue = data[firstKey];
    if (Array.isArray(firstValue) && firstValue.length > 0) {
      return String(firstValue[0]);
    }
    if (typeof firstValue === 'string') {
      return firstValue;
    }
  }

  return fallback;
}

function accionLabel(action) {
  const map = {
    crear: 'Creacion',
    actualizar: 'Actualizacion',
    eliminar: 'Eliminacion',
  };
  return map[action] || action;
}

function entidadLabel(entity) {
  const map = {
    producto: 'Producto',
    ingrediente: 'Ingrediente',
    mesa: 'Mesa',
    inventario_entrada: 'Entrada inventario',
  };
  return map[entity] || entity;
}

function AdminPage() {
  const [activeModule, setActiveModule] = useState('resumen');
  const [periodo, setPeriodo] = useState('todo');
  const [dashboard, setDashboard] = useState({
    kpis: {
      ventas_hoy: 0,
      pedidos_hoy: 0,
      pedidos_activos: 0,
      pedidos_listos: 0,
      stock_bajo: 0,
      movimientos_hoy: 0,
    },
  });
  const [health, setHealth] = useState({ ok: true, database: { ok: true, error: '' } });

  const [top, setTop] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [acciones, setAcciones] = useState([]);

  const [entradaForm, setEntradaForm] = useState({ ingrediente_id: '', cantidad: '', observacion: '' });
  const [productoForm, setProductoForm] = useState({ nombre: '', tipo: 'pizza', precio: '', activo: true });
  const [ingredienteForm, setIngredienteForm] = useState({ nombre: '', unidad: '', stock_actual: '', stock_minimo: '' });
  const [mesaForm, setMesaForm] = useState({ numero_mesa: '', estado: 'libre' });

  const [loading, setLoading] = useState(true);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(
    async (currentPeriodo = periodo) => {
      const endpoints = [
        { key: 'dashboard', label: 'dashboard', request: client.get('/admin/dashboard/') },
        { key: 'reporte', label: 'reporte top productos', request: client.get(`/reportes/top-productos/?periodo=${currentPeriodo}`) },
        { key: 'movimientos', label: 'movimientos inventario', request: client.get('/inventario/movimientos/') },
        { key: 'productos', label: 'catalogo productos', request: client.get('/admin/productos/') },
        { key: 'ingredientes', label: 'catalogo ingredientes', request: client.get('/admin/ingredientes/') },
        { key: 'mesas', label: 'catalogo mesas', request: client.get('/admin/mesas/') },
        { key: 'acciones', label: 'historial de acciones', request: client.get('/admin/acciones/?limite=35') },
        { key: 'health', label: 'estado base de datos', request: client.get('/health/') },
      ];

      try {
        const results = await Promise.allSettled(endpoints.map((item) => item.request));
        const failedModules = [];

        results.forEach((result, idx) => {
          const key = endpoints[idx].key;
          const label = endpoints[idx].label;
          if (result.status !== 'fulfilled') {
            failedModules.push(label);
            return;
          }

          const payload = result.value?.data;
          if (key === 'dashboard') setDashboard(payload || { kpis: {} });
          if (key === 'reporte') setTop(payload?.top_productos || []);
          if (key === 'movimientos') setMovimientos(payload || []);
          if (key === 'productos') setProductos(payload || []);
          if (key === 'ingredientes') {
            setIngredientes(payload || []);
            if (!entradaForm.ingrediente_id && payload?.length > 0) {
              setEntradaForm((prev) => ({ ...prev, ingrediente_id: String(payload[0].id) }));
            }
          }
          if (key === 'mesas') setMesas(payload || []);
          if (key === 'acciones') setAcciones(payload || []);
          if (key === 'health') setHealth(payload || { ok: false, database: { ok: false, error: 'Sin respuesta' } });
        });

        if (failedModules.length > 0) {
          setError(`No se cargaron algunos modulos: ${failedModules.join(', ')}.`);
        } else {
          setError('');
        }
      } catch (err) {
        setError(parseApiError(err, 'No se pudo cargar la informacion del panel admin.'));
      } finally {
        setLoading(false);
      }
    },
    [periodo, entradaForm.ingrediente_id]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePeriodo = (newPeriodo) => {
    setPeriodo(newPeriodo);
    loadData(newPeriodo);
  };

  const submitEntrada = async (e) => {
    e.preventDefault();
    try {
      await client.post('/inventario/entradas/', {
        ingrediente_id: Number(entradaForm.ingrediente_id),
        cantidad: Number(entradaForm.cantidad),
        observacion: entradaForm.observacion,
      });
      setEntradaForm((prev) => ({ ...prev, cantidad: '', observacion: '' }));
      setMessage('Entrada registrada correctamente.');
      await loadData();
    } catch (err) {
      setError(parseApiError(err, 'No se pudo registrar la entrada de inventario.'));
    }
  };

  const createProducto = async (e) => {
    e.preventDefault();
    try {
      await client.post('/admin/productos/', {
        nombre: productoForm.nombre,
        tipo: productoForm.tipo,
        precio: Number(productoForm.precio),
        activo: productoForm.activo,
      });
      setProductoForm({ nombre: '', tipo: 'pizza', precio: '', activo: true });
      setMessage('Producto creado.');
      await loadData();
    } catch (err) {
      setError(parseApiError(err, 'No se pudo crear el producto.'));
    }
  };

  const updateProductoField = (id, field, value) => {
    setProductos((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const saveProducto = async (producto) => {
    try {
      await client.patch(`/admin/productos/${producto.id}/`, {
        nombre: producto.nombre,
        tipo: producto.tipo,
        precio: Number(producto.precio),
        activo: Boolean(producto.activo),
      });
      setMessage('Producto actualizado.');
      await loadData();
    } catch (err) {
      setError(parseApiError(err, 'No se pudo actualizar el producto.'));
    }
  };

  const deleteProducto = async (id) => {
    try {
      await client.delete(`/admin/productos/${id}/`);
      setMessage('Producto eliminado.');
      await loadData();
    } catch (err) {
      setError(parseApiError(err, 'No se pudo eliminar el producto.'));
    }
  };

  const createIngrediente = async (e) => {
    e.preventDefault();
    try {
      await client.post('/admin/ingredientes/', {
        nombre: ingredienteForm.nombre,
        unidad: ingredienteForm.unidad,
        stock_actual: Number(ingredienteForm.stock_actual),
        stock_minimo: Number(ingredienteForm.stock_minimo),
      });
      setIngredienteForm({ nombre: '', unidad: '', stock_actual: '', stock_minimo: '' });
      setMessage('Ingrediente creado.');
      await loadData();
    } catch (err) {
      setError(parseApiError(err, 'No se pudo crear el ingrediente.'));
    }
  };

  const updateIngredienteField = (id, field, value) => {
    setIngredientes((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const saveIngrediente = async (ingrediente) => {
    try {
      await client.patch(`/admin/ingredientes/${ingrediente.id}/`, {
        nombre: ingrediente.nombre,
        unidad: ingrediente.unidad,
        stock_actual: Number(ingrediente.stock_actual),
        stock_minimo: Number(ingrediente.stock_minimo),
      });
      setMessage('Ingrediente actualizado.');
      await loadData();
    } catch (err) {
      setError(parseApiError(err, 'No se pudo actualizar el ingrediente.'));
    }
  };

  const deleteIngrediente = async (id) => {
    try {
      await client.delete(`/admin/ingredientes/${id}/`);
      setMessage('Ingrediente eliminado.');
      await loadData();
    } catch (err) {
      setError(parseApiError(err, 'No se pudo eliminar el ingrediente.'));
    }
  };

  const createMesa = async (e) => {
    e.preventDefault();
    try {
      await client.post('/admin/mesas/', {
        numero_mesa: Number(mesaForm.numero_mesa),
        estado: mesaForm.estado,
      });
      setMesaForm({ numero_mesa: '', estado: 'libre' });
      setMessage('Mesa creada.');
      await loadData();
    } catch (err) {
      setError(parseApiError(err, 'No se pudo crear la mesa.'));
    }
  };

  const updateMesaField = (id, field, value) => {
    setMesas((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const saveMesa = async (mesa) => {
    try {
      await client.patch(`/admin/mesas/${mesa.id}/`, {
        numero_mesa: Number(mesa.numero_mesa),
        estado: mesa.estado,
      });
      setMessage('Mesa actualizada.');
      await loadData();
    } catch (err) {
      setError(parseApiError(err, 'No se pudo actualizar la mesa.'));
    }
  };

  const deleteMesa = async (id) => {
    try {
      await client.delete(`/admin/mesas/${id}/`);
      setMessage('Mesa eliminada.');
      await loadData();
    } catch (err) {
      setError(parseApiError(err, 'No se pudo eliminar la mesa.'));
    }
  };

  const undoAction = async (accionId) => {
    try {
      setActionBusyId(accionId);
      await client.post(`/admin/acciones/${accionId}/deshacer/`, {});
      setMessage('Accion deshecha correctamente.');
      await loadData();
    } catch (err) {
      setError(parseApiError(err, 'No se pudo deshacer la accion.'));
    } finally {
      setActionBusyId(null);
    }
  };

  const kpis = dashboard?.kpis || {};
  const ingredientesBajo = useMemo(() => ingredientes.filter((item) => item.bajo_minimo), [ingredientes]);

  return (
    <main className="screen admin-screen">
      <section className="hero hero-dark">
        <h1>Panel Administrativo</h1>
        <p>Menu por modulos, control operativo y auditoria con deshacer</p>
      </section>

      <section className="panel-layout">
        <PanelSidebar
          title="Admin"
          subtitle="Centro de control"
          items={ADMIN_MODULES}
          activeKey={activeModule}
          onChange={setActiveModule}
        />

        <section className="panel-content">
          {error && <p className="error-box panel-msg">{error}</p>}
          {message && <p className="ok-box panel-msg">{message}</p>}

          <section className="admin-toolbar">
            <button type="button" onClick={() => loadData()}>
              <RefreshCcw size={16} /> Actualizar datos
            </button>
          </section>

          {activeModule === 'resumen' && (
            <>
              <section className="kpi-grid kpi-grid-admin">
                <article className="kpi-card">
                  <p>Ventas hoy</p>
                  <strong>{money(kpis.ventas_hoy)}</strong>
                </article>
                <article className="kpi-card">
                  <p>Pedidos hoy</p>
                  <strong>{kpis.pedidos_hoy || 0}</strong>
                </article>
                <article className="kpi-card urgent">
                  <p>Pedidos activos</p>
                  <strong>{kpis.pedidos_activos || 0}</strong>
                </article>
                <article className="kpi-card ready">
                  <p>Pedidos listos</p>
                  <strong>{kpis.pedidos_listos || 0}</strong>
                </article>
                <article className="kpi-card oven">
                  <p>Movimientos hoy</p>
                  <strong>{kpis.movimientos_hoy || 0}</strong>
                </article>
                <article className="kpi-card urgent">
                  <p>Stock bajo</p>
                  <strong>{kpis.stock_bajo || 0}</strong>
                </article>
              </section>

              <section className="admin-grid">
                <article className="card">
                  <h2>
                    <BarChart3 size={20} /> Top productos vendidos
                  </h2>
                  <div className="period-filters">
                    {['hoy', 'semana', 'mes', 'todo'].map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={periodo === item ? 'active' : ''}
                        onClick={() => handlePeriodo(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <div className="simple-table">
                    {top.map((row) => (
                      <div key={row.producto_id}>
                        <strong>{row.producto_nombre}</strong>
                        <span>{row.total_vendido} uds</span>
                        <span>{money(row.importe)}</span>
                      </div>
                    ))}
                    {!loading && top.length === 0 && <p>Sin ventas registradas para este periodo.</p>}
                  </div>
                </article>

                <article className="card">
                  <h2>
                    <AlertTriangle size={20} /> Salud del sistema
                  </h2>
                  <div className="simple-table">
                    <div>
                      <strong>API</strong>
                      <span>{health?.ok ? 'Operativa' : 'Con problemas'}</span>
                      <span>{health?.timestamp ? new Date(health.timestamp).toLocaleString('es-MX') : '-'}</span>
                    </div>
                    <div>
                      <strong>Base de datos</strong>
                      <span>{health?.database?.ok ? 'Conectada' : 'Sin conexion'}</span>
                      <span>{health?.database?.error || '-'}</span>
                    </div>
                    <div>
                      <strong>Ingredientes bajo minimo</strong>
                      <span>{ingredientesBajo.length}</span>
                      <span>Reponer inventario</span>
                    </div>
                  </div>
                </article>
              </section>
            </>
          )}

          {activeModule === 'inventario' && (
            <section className="admin-grid">
              <article className="card">
                <h2>
                  <Boxes size={20} /> Entradas de inventario
                </h2>
                <form className="inventory-form" onSubmit={submitEntrada}>
                  <label>
                    Ingrediente
                    <select
                      value={entradaForm.ingrediente_id}
                      onChange={(e) => setEntradaForm((prev) => ({ ...prev, ingrediente_id: e.target.value }))}
                    >
                      {ingredientes.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Cantidad
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={entradaForm.cantidad}
                      onChange={(e) => setEntradaForm((prev) => ({ ...prev, cantidad: e.target.value }))}
                    />
                  </label>
                  <label>
                    Observacion
                    <input
                      type="text"
                      value={entradaForm.observacion}
                      onChange={(e) => setEntradaForm((prev) => ({ ...prev, observacion: e.target.value }))}
                    />
                  </label>
                  <button type="submit">
                    <PlusCircle size={16} /> Registrar entrada
                  </button>
                </form>
              </article>

              <article className="card">
                <h2>
                  <AlertTriangle size={20} /> Alertas de stock
                </h2>
                <div className="simple-table">
                  {ingredientes.map((ing) => (
                    <div key={ing.id} className={ing.bajo_minimo ? 'alert-row' : ''}>
                      <strong>{ing.nombre}</strong>
                      <span>
                        {ing.stock_actual} {ing.unidad}
                      </span>
                      <span>Min: {ing.stock_minimo}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="card">
                <h2>Ultimos movimientos</h2>
                <div className="simple-table">
                  {movimientos.slice(0, 14).map((mov) => (
                    <div key={mov.id}>
                      <strong>{mov.tipo.toUpperCase()}</strong>
                      <span>{mov.ingrediente_nombre}</span>
                      <span>{mov.cantidad}</span>
                    </div>
                  ))}
                  {!loading && movimientos.length === 0 && <p>No hay movimientos registrados.</p>}
                </div>
              </article>
            </section>
          )}

          {activeModule === 'catalogos' && (
            <section className="admin-grid">
              <article className="card">
                <h2>Productos</h2>
                <form className="inventory-form compact-form" onSubmit={createProducto}>
                  <input
                    type="text"
                    required
                    placeholder="Nombre"
                    value={productoForm.nombre}
                    onChange={(e) => setProductoForm((prev) => ({ ...prev, nombre: e.target.value }))}
                  />
                  <select
                    value={productoForm.tipo}
                    onChange={(e) => setProductoForm((prev) => ({ ...prev, tipo: e.target.value }))}
                  >
                    {PRODUCT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Precio"
                    value={productoForm.precio}
                    onChange={(e) => setProductoForm((prev) => ({ ...prev, precio: e.target.value }))}
                  />
                  <label className="check-inline">
                    <input
                      type="checkbox"
                      checked={productoForm.activo}
                      onChange={(e) => setProductoForm((prev) => ({ ...prev, activo: e.target.checked }))}
                    />
                    Activo
                  </label>
                  <button type="submit">
                    <PlusCircle size={16} /> Crear
                  </button>
                </form>

                <div className="crud-list">
                  {productos.map((item) => (
                    <div key={item.id} className="crud-row">
                      <input
                        type="text"
                        value={item.nombre}
                        onChange={(e) => updateProductoField(item.id, 'nombre', e.target.value)}
                      />
                      <select value={item.tipo} onChange={(e) => updateProductoField(item.id, 'tipo', e.target.value)}>
                        {PRODUCT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        value={item.precio}
                        onChange={(e) => updateProductoField(item.id, 'precio', e.target.value)}
                      />
                      <label className="check-inline">
                        <input
                          type="checkbox"
                          checked={Boolean(item.activo)}
                          onChange={(e) => updateProductoField(item.id, 'activo', e.target.checked)}
                        />
                        Activo
                      </label>
                      <div className="crud-actions">
                        <button type="button" onClick={() => saveProducto(item)}>
                          <Save size={15} /> Guardar
                        </button>
                        <button type="button" className="danger-btn" onClick={() => deleteProducto(item.id)}>
                          <Trash2 size={15} /> Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="card">
                <h2>Ingredientes</h2>
                <form className="inventory-form compact-form" onSubmit={createIngrediente}>
                  <input
                    type="text"
                    required
                    placeholder="Nombre"
                    value={ingredienteForm.nombre}
                    onChange={(e) => setIngredienteForm((prev) => ({ ...prev, nombre: e.target.value }))}
                  />
                  <input
                    type="text"
                    required
                    placeholder="Unidad"
                    value={ingredienteForm.unidad}
                    onChange={(e) => setIngredienteForm((prev) => ({ ...prev, unidad: e.target.value }))}
                  />
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Stock actual"
                    value={ingredienteForm.stock_actual}
                    onChange={(e) => setIngredienteForm((prev) => ({ ...prev, stock_actual: e.target.value }))}
                  />
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Stock minimo"
                    value={ingredienteForm.stock_minimo}
                    onChange={(e) => setIngredienteForm((prev) => ({ ...prev, stock_minimo: e.target.value }))}
                  />
                  <button type="submit">
                    <PlusCircle size={16} /> Crear
                  </button>
                </form>

                <div className="crud-list">
                  {ingredientes.map((item) => (
                    <div key={item.id} className={`crud-row ${item.bajo_minimo ? 'alert-row' : ''}`}>
                      <input
                        type="text"
                        value={item.nombre}
                        onChange={(e) => updateIngredienteField(item.id, 'nombre', e.target.value)}
                      />
                      <input
                        type="text"
                        value={item.unidad}
                        onChange={(e) => updateIngredienteField(item.id, 'unidad', e.target.value)}
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={item.stock_actual}
                        onChange={(e) => updateIngredienteField(item.id, 'stock_actual', e.target.value)}
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={item.stock_minimo}
                        onChange={(e) => updateIngredienteField(item.id, 'stock_minimo', e.target.value)}
                      />
                      <div className="crud-actions">
                        <button type="button" onClick={() => saveIngrediente(item)}>
                          <Save size={15} /> Guardar
                        </button>
                        <button type="button" className="danger-btn" onClick={() => deleteIngrediente(item.id)}>
                          <Trash2 size={15} /> Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="card">
                <h2>Mesas</h2>
                <form className="inventory-form compact-form" onSubmit={createMesa}>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Numero de mesa"
                    value={mesaForm.numero_mesa}
                    onChange={(e) => setMesaForm((prev) => ({ ...prev, numero_mesa: e.target.value }))}
                  />
                  <select value={mesaForm.estado} onChange={(e) => setMesaForm((prev) => ({ ...prev, estado: e.target.value }))}>
                    {MESA_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  <button type="submit">
                    <PlusCircle size={16} /> Crear
                  </button>
                </form>

                <div className="crud-list">
                  {mesas.map((item) => (
                    <div key={item.id} className="crud-row">
                      <input
                        type="number"
                        min="1"
                        value={item.numero_mesa}
                        onChange={(e) => updateMesaField(item.id, 'numero_mesa', e.target.value)}
                      />
                      <select value={item.estado} onChange={(e) => updateMesaField(item.id, 'estado', e.target.value)}>
                        {MESA_STATES.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                      <div className="crud-actions">
                        <button type="button" onClick={() => saveMesa(item)}>
                          <Save size={15} /> Guardar
                        </button>
                        <button type="button" className="danger-btn" onClick={() => deleteMesa(item.id)}>
                          <Trash2 size={15} /> Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          )}

          {activeModule === 'auditoria' && (
            <section className="admin-grid">
              <article className="card">
                <h2>
                  <History size={20} /> Historial de cambios
                </h2>
                <div className="action-history">
                  {acciones.map((accion) => (
                    <div key={accion.id} className="action-row">
                      <div>
                        <strong>
                          {entidadLabel(accion.entidad)} - {accionLabel(accion.accion)}
                        </strong>
                        <p>{accion.detalle || 'Cambio administrativo'}</p>
                        <small>
                          {new Date(accion.creado_en).toLocaleString('es-MX')} - {accion.creado_por_username || 'sistema'}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => undoAction(accion.id)}
                        disabled={accion.deshecha || actionBusyId === accion.id}
                      >
                        <RotateCcw size={15} />
                        {accion.deshecha ? 'Deshecha' : actionBusyId === accion.id ? 'Procesando...' : 'Deshacer'}
                      </button>
                    </div>
                  ))}
                  {!loading && acciones.length === 0 && <p>No hay acciones registradas.</p>}
                </div>
              </article>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

export default AdminPage;
