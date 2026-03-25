import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  History,
  LayoutDashboard,
  Package,
  PlusCircle,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import client from '../api/client';
import PanelSidebar from '../components/PanelSidebar';
import { BarsChart, DonutChart, ProgressChart, TrendChart } from '../components/AdminCharts';
import { money } from '../utils/format';

const PRODUCT_TYPES = ['pizza', 'bebida', 'postre', 'combo'];
const PRODUCT_TYPE_LABELS = {
  pizza: 'Pizzas',
  bebida: 'Bebidas',
  postre: 'Postres',
  combo: 'Combos',
};
const MESA_STATES = ['libre', 'ocupada'];

function parseApiError(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;

  const data = err?.response?.data;
  if (data && typeof data === 'object') {
    const firstKey = Object.keys(data)[0];
    const firstValue = data[firstKey];
    if (Array.isArray(firstValue) && firstValue.length > 0) return String(firstValue[0]);
    if (typeof firstValue === 'string') return firstValue;
  }

  return fallback;
}

function accionLabel(action) {
  const map = { crear: 'Creacion', actualizar: 'Actualizacion', eliminar: 'Eliminacion' };
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

function countFormatter(value) {
  return new Intl.NumberFormat('es-MX').format(Number(value || 0));
}

function dateLabel(value) {
  return new Date(value).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function matchesQuery(value, query) {
  if (!query) return true;
  return String(value || '').toLowerCase().includes(query.toLowerCase());
}

function buildMovementTrend(movimientos) {
  const grouped = new Map();
  movimientos.slice(0, 24).forEach((movimiento) => {
    const key = new Date(movimiento.fecha_hora).toISOString().slice(0, 10);
    const current = grouped.get(key) || { count: 0, label: dateLabel(movimiento.fecha_hora) };
    current.count += 1;
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .slice(-7)
    .map((item) => ({ label: item.label, value: item.count }));
}

function SummaryKpi({ title, value, helper, tone = 'default' }) {
  return (
    <article className={`kpi-card ${tone !== 'default' ? tone : ''}`}>
      <p>{title}</p>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function AdminPage() {
  const [activeModule, setActiveModule] = useState('resumen');
  const [periodo, setPeriodo] = useState('todo');
  const [catalogQuery, setCatalogQuery] = useState('');
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
  const [lastUpdated, setLastUpdated] = useState('');
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

        setError(failedModules.length > 0 ? `No se cargaron algunos modulos: ${failedModules.join(', ')}.` : '');
        setLastUpdated(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
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
  const productosActivos = useMemo(() => productos.filter((item) => item.activo).length, [productos]);
  const mesasOcupadas = useMemo(() => mesas.filter((item) => item.estado === 'ocupada').length, [mesas]);
  const accionesActivas = useMemo(() => acciones.filter((item) => !item.deshecha).length, [acciones]);

  const moduleItems = useMemo(
    () => [
      { key: 'resumen', label: 'Resumen', icon: LayoutDashboard, meta: `${kpis.pedidos_hoy || 0} pedidos` },
      { key: 'inventario', label: 'Inventario', icon: Boxes, meta: `${ingredientesBajo.length} alertas` },
      { key: 'catalogos', label: 'Catalogos', icon: Package, meta: `${productos.length + ingredientes.length + mesas.length} registros` },
      { key: 'auditoria', label: 'Auditoria', icon: History, meta: `${acciones.length} acciones` },
    ],
    [acciones.length, ingredientes.length, ingredientesBajo.length, kpis.pedidos_hoy, mesas.length, productos.length]
  );

  const topVolumeChart = useMemo(
    () =>
      top.slice(0, 6).map((item) => ({
        label: item.producto_nombre,
        value: Number(item.total_vendido || 0),
        helper: money(item.importe),
      })),
    [top]
  );

  const revenueMixChart = useMemo(
    () =>
      top.slice(0, 5).map((item) => ({
        label: item.producto_nombre,
        value: Number(item.importe || 0),
      })),
    [top]
  );

  const movementTrendChart = useMemo(() => buildMovementTrend(movimientos), [movimientos]);

  const catalogCompositionChart = useMemo(
    () =>
      PRODUCT_TYPES.map((type) => {
        const items = productos.filter((producto) => producto.tipo === type);
        return {
          label: PRODUCT_TYPE_LABELS[type],
          value: items.filter((item) => item.activo).length,
          total: items.length || 1,
          helper: `${items.length} registros`,
        };
      }).filter((item) => item.total > 0),
    [productos]
  );

  const q = catalogQuery.trim().toLowerCase();
  const filteredProductos = useMemo(
    () => productos.filter((item) => matchesQuery(`${item.nombre} ${item.tipo}`, q)),
    [productos, q]
  );
  const filteredIngredientes = useMemo(
    () => ingredientes.filter((item) => matchesQuery(`${item.nombre} ${item.unidad}`, q)),
    [ingredientes, q]
  );
  const filteredMesas = useMemo(
    () => mesas.filter((item) => matchesQuery(`mesa ${item.numero_mesa} ${item.estado}`, q)),
    [mesas, q]
  );

  return (
    <main className="screen admin-screen">
      <section className="hero hero-dark">
        <div className="hero__grid">
          <div className="hero__content">
            <p className="hero__eyebrow">Staff / administracion</p>
            <h1>Control administrativo con dashboards visuales y catalogos mas claros.</h1>
            <p>Resumen ejecutivo en MXN, analitica operativa y edicion de catalogos con mejor lectura para un POS real.</p>
          </div>

          <div className="hero__stats">
            <article className="hero-stat">
              <span>Ventas hoy</span>
              <strong>{money(kpis.ventas_hoy)}</strong>
            </article>
            <article className="hero-stat">
              <span>Stock bajo</span>
              <strong>{ingredientesBajo.length}</strong>
            </article>
            <article className="hero-stat">
              <span>Productos activos</span>
              <strong>{productosActivos}</strong>
            </article>
          </div>
        </div>
      </section>

      <section className="panel-layout">
        <PanelSidebar
          title="Admin"
          subtitle="Centro de control"
          items={moduleItems}
          activeKey={activeModule}
          onChange={setActiveModule}
          footer={
            <div className="sidebar-note">
              <strong>Estado del sistema</strong>
              <p>{health?.database?.ok ? 'Base de datos operativa.' : 'Base de datos con incidencias.'}</p>
              <p>{lastUpdated ? `Actualizado a las ${lastUpdated}.` : 'Consultando modulos...'}</p>
            </div>
          }
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
              <section className="card ops-note">
                <div className="content-head">
                  <div>
                    <p className="section-kicker">Resumen ejecutivo</p>
                    <h2>Metricas con lectura visual inmediata</h2>
                  </div>
                  <span className="section-badge">Dashboard administrativo</span>
                </div>
                <p>
                  Este tablero prioriza ventas, movimiento de inventario, mezcla de catalogo y salud general usando graficas ligeras integradas sin cambiar los endpoints actuales.
                </p>
              </section>

              <section className="kpi-grid kpi-grid-admin">
                <SummaryKpi title="Ventas hoy" value={money(kpis.ventas_hoy)} helper="Ingresos acumulados" />
                <SummaryKpi title="Pedidos hoy" value={countFormatter(kpis.pedidos_hoy || 0)} helper="Tickets procesados" />
                <SummaryKpi title="Pedidos activos" value={countFormatter(kpis.pedidos_activos || 0)} helper="Aun en operacion" tone="urgent" />
                <SummaryKpi title="Pedidos listos" value={countFormatter(kpis.pedidos_listos || 0)} helper="Listos para entrega" tone="ready" />
                <SummaryKpi title="Movimientos hoy" value={countFormatter(kpis.movimientos_hoy || 0)} helper="Entradas y salidas" tone="oven" />
                <SummaryKpi title="Stock bajo" value={countFormatter(kpis.stock_bajo || 0)} helper="Requiere atencion" tone="urgent" />
              </section>

              <section className="dashboard-charts-grid">
                <article className="card chart-card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Volumen</p>
                      <h2>
                        <BarChart3 size={20} /> Top productos por unidades
                      </h2>
                    </div>
                    <span className="section-badge">{periodo}</span>
                  </div>
                  <div className="period-filters">
                    {['hoy', 'semana', 'mes', 'todo'].map((item) => (
                      <button key={item} type="button" className={periodo === item ? 'active' : ''} onClick={() => handlePeriodo(item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                  {topVolumeChart.length === 0 ? (
                    <div className="empty-state">
                      <strong>Sin datos de ventas</strong>
                      <p>No hay registros suficientes para generar la grafica de volumen.</p>
                    </div>
                  ) : (
                    <BarsChart data={topVolumeChart} formatter={(value) => `${countFormatter(value)} uds`} />
                  )}
                </article>

                <article className="card chart-card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Ingresos</p>
                      <h2>Distribucion de facturacion</h2>
                    </div>
                    <span className="section-badge">{top.length} productos</span>
                  </div>
                  {revenueMixChart.length === 0 ? (
                    <div className="empty-state">
                      <strong>Sin mezcla de ingresos</strong>
                      <p>Cuando existan ventas, aqui veras la proporcion por producto.</p>
                    </div>
                  ) : (
                    <DonutChart
                      data={revenueMixChart}
                      centerLabel="Ingresos"
                      centerValue={revenueMixChart.reduce((acc, item) => acc + Number(item.value || 0), 0)}
                      formatter={money}
                    />
                  )}
                </article>

                <article className="card chart-card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Actividad</p>
                      <h2>Tendencia de movimientos</h2>
                    </div>
                    <span className="section-badge">Ultimos registros</span>
                  </div>
                  {movementTrendChart.length === 0 ? (
                    <div className="empty-state">
                      <strong>Sin tendencia disponible</strong>
                      <p>Las entradas y salidas de inventario apareceran aqui.</p>
                    </div>
                  ) : (
                    <TrendChart data={movementTrendChart} formatter={(value) => `${countFormatter(value)} mov`} />
                  )}
                </article>

                <article className="card chart-card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Catalogo</p>
                      <h2>Composicion por categoria</h2>
                    </div>
                    <span className="section-badge">{productos.length} items</span>
                  </div>
                  {catalogCompositionChart.length === 0 ? (
                    <div className="empty-state">
                      <strong>Sin productos cargados</strong>
                      <p>Agrega productos para visualizar la cobertura del menu.</p>
                    </div>
                  ) : (
                    <ProgressChart data={catalogCompositionChart} formatter={(value) => `${countFormatter(value)} activos`} />
                  )}
                </article>
              </section>

              <section className="admin-grid">
                <article className="card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Monitoreo</p>
                      <h2>
                        <AlertTriangle size={20} /> Salud del sistema
                      </h2>
                    </div>
                    <span className="section-badge">{health?.database?.ok ? 'Operativo' : 'Revisar'}</span>
                  </div>
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
                      <strong>Acciones activas</strong>
                      <span>{accionesActivas}</span>
                      <span>Con trazabilidad</span>
                    </div>
                  </div>
                </article>

                <article className="card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Inventario critico</p>
                      <h2>
                        <Boxes size={20} /> Ingredientes con prioridad
                      </h2>
                    </div>
                    <span className="section-badge">{ingredientesBajo.length} alertas</span>
                  </div>
                  {ingredientesBajo.length === 0 ? (
                    <div className="empty-state">
                      <strong>Sin alertas de inventario</strong>
                      <p>Todos los ingredientes estan por encima del minimo configurado.</p>
                    </div>
                  ) : (
                    <div className="stack-list">
                      {ingredientesBajo.slice(0, 6).map((ing) => (
                        <div key={`low-${ing.id}`} className="stack-list__item">
                          <div>
                            <strong>{ing.nombre}</strong>
                            <p>
                              Stock actual: {ing.stock_actual} {ing.unidad}
                            </p>
                          </div>
                          <span>Min: {ing.stock_minimo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                <article className="card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Actividad reciente</p>
                      <h2>
                        <History size={20} /> Ultimos cambios admin
                      </h2>
                    </div>
                    <span className="section-badge">{accionesActivas} vigentes</span>
                  </div>
                  {acciones.length === 0 ? (
                    <div className="empty-state">
                      <strong>Sin actividad</strong>
                      <p>Aun no se registran acciones administrativas.</p>
                    </div>
                  ) : (
                    <div className="stack-list">
                      {acciones.slice(0, 5).map((accion) => (
                        <div key={`resume-action-${accion.id}`} className="stack-list__item">
                          <div>
                            <strong>
                              {entidadLabel(accion.entidad)} - {accionLabel(accion.accion)}
                            </strong>
                            <p>{accion.detalle || 'Cambio administrativo'}</p>
                          </div>
                          <span>{accion.deshecha ? 'Deshecha' : 'Activa'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </section>
            </>
          )}

          {activeModule === 'inventario' && (
            <>
              <section className="kpi-grid">
                <SummaryKpi title="Ingredientes" value={countFormatter(ingredientes.length)} helper="Catalogo de insumos" />
                <SummaryKpi title="Stock bajo" value={countFormatter(ingredientesBajo.length)} helper="Necesita reposicion" tone="urgent" />
                <SummaryKpi title="Movimientos" value={countFormatter(movimientos.length)} helper="Bitacora reciente" tone="oven" />
              </section>

              <section className="admin-grid">
                <article className="card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Captura</p>
                      <h2>
                        <Boxes size={20} /> Entradas de inventario
                      </h2>
                    </div>
                    <span className="section-badge">Registro manual</span>
                  </div>
                  <form className="inventory-form" onSubmit={submitEntrada}>
                    <label>
                      Ingrediente
                      <select value={entradaForm.ingrediente_id} onChange={(e) => setEntradaForm((prev) => ({ ...prev, ingrediente_id: e.target.value }))}>
                        {ingredientes.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Cantidad
                      <input type="number" step="0.01" required value={entradaForm.cantidad} onChange={(e) => setEntradaForm((prev) => ({ ...prev, cantidad: e.target.value }))} />
                    </label>
                    <label>
                      Observacion
                      <input type="text" value={entradaForm.observacion} onChange={(e) => setEntradaForm((prev) => ({ ...prev, observacion: e.target.value }))} />
                    </label>
                    <button type="submit">
                      <PlusCircle size={16} /> Registrar entrada
                    </button>
                  </form>
                </article>

                <article className="card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Tendencia</p>
                      <h2>Movimiento reciente</h2>
                    </div>
                    <span className="section-badge">Ultimos 7 cortes</span>
                  </div>
                  {movementTrendChart.length === 0 ? (
                    <div className="empty-state">
                      <strong>Sin movimientos</strong>
                      <p>Aun no hay entradas o salidas registradas.</p>
                    </div>
                  ) : (
                    <TrendChart data={movementTrendChart} formatter={(value) => `${countFormatter(value)} mov`} />
                  )}
                </article>

                <article className="card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Seguimiento</p>
                      <h2>
                        <AlertTriangle size={20} /> Alertas de stock
                      </h2>
                    </div>
                    <span className="section-badge">{ingredientesBajo.length} criticos</span>
                  </div>
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
              </section>
            </>
          )}

          {activeModule === 'catalogos' && (
            <>
              <section className="kpi-grid">
                <SummaryKpi title="Productos" value={countFormatter(productos.length)} helper={`${productosActivos} activos`} />
                <SummaryKpi
                  title="Ingredientes"
                  value={countFormatter(ingredientes.length)}
                  helper={`${ingredientesBajo.length} con riesgo`}
                  tone={ingredientesBajo.length > 0 ? 'urgent' : 'ready'}
                />
                <SummaryKpi title="Mesas" value={countFormatter(mesas.length)} helper={`${mesasOcupadas} ocupadas`} tone="oven" />
              </section>

              <section className="card catalog-toolbar">
                <div className="content-head">
                  <div>
                    <p className="section-kicker">Catalogos</p>
                    <h2>Edicion mas clara para productos, insumos y mesas</h2>
                  </div>
                  <span className="section-badge">CRUD compatible con backend actual</span>
                </div>
                <div className="catalog-toolbar__controls">
                  <label className="catalog-search">
                    <Search size={16} />
                    <input type="text" placeholder="Buscar por nombre, tipo o estado" value={catalogQuery} onChange={(e) => setCatalogQuery(e.target.value)} />
                  </label>
                  <p>Filtro transversal para localizar registros sin perder el contexto del modulo.</p>
                </div>
              </section>

              <section className="catalog-section">
                <article className="card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Productos</p>
                      <h2>Precios y menu</h2>
                    </div>
                    <span className="section-badge">{filteredProductos.length} visibles</span>
                  </div>

                  <form className="inventory-form catalog-create-form" onSubmit={createProducto}>
                    <label>
                      Nombre
                      <input type="text" required placeholder="Ej. Pizza Pepperoni Grande" value={productoForm.nombre} onChange={(e) => setProductoForm((prev) => ({ ...prev, nombre: e.target.value }))} />
                    </label>
                    <label>
                      Tipo
                      <select value={productoForm.tipo} onChange={(e) => setProductoForm((prev) => ({ ...prev, tipo: e.target.value }))}>
                        {PRODUCT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {PRODUCT_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Precio MXN
                      <input type="number" min="1" step="1" required placeholder="159" value={productoForm.precio} onChange={(e) => setProductoForm((prev) => ({ ...prev, precio: e.target.value }))} />
                    </label>
                    <label className="check-inline">
                      <input type="checkbox" checked={productoForm.activo} onChange={(e) => setProductoForm((prev) => ({ ...prev, activo: e.target.checked }))} />
                      Activo
                    </label>
                    <div className="catalog-create-form__preview">
                      <span>Vista previa</span>
                      <strong>{money(productoForm.precio || 0)}</strong>
                    </div>
                    <button type="submit">
                      <PlusCircle size={16} /> Crear producto
                    </button>
                  </form>

                  <div className="catalog-editor-grid">
                    {filteredProductos.map((item) => (
                      <article key={item.id} className="catalog-item-card">
                        <div className="catalog-item-card__head">
                          <div>
                            <p className="section-kicker">Producto</p>
                            <h3>{item.nombre}</h3>
                          </div>
                          <span className={`catalog-status ${item.activo ? 'is-active' : 'is-muted'}`}>{item.activo ? 'Activo' : 'Inactivo'}</span>
                        </div>

                        <div className="catalog-price-chip">{money(item.precio)}</div>

                        <div className="catalog-fields">
                          <label>
                            <span>Nombre</span>
                            <input type="text" value={item.nombre} onChange={(e) => updateProductoField(item.id, 'nombre', e.target.value)} />
                          </label>
                          <label>
                            <span>Tipo</span>
                            <select value={item.tipo} onChange={(e) => updateProductoField(item.id, 'tipo', e.target.value)}>
                              {PRODUCT_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {PRODUCT_TYPE_LABELS[type]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Precio MXN</span>
                            <input type="number" min="1" step="1" value={item.precio} onChange={(e) => updateProductoField(item.id, 'precio', e.target.value)} />
                          </label>
                          <label className="check-inline catalog-check">
                            <input type="checkbox" checked={Boolean(item.activo)} onChange={(e) => updateProductoField(item.id, 'activo', e.target.checked)} />
                            Activo
                          </label>
                        </div>

                        <div className="catalog-item-card__footer">
                          <button type="button" onClick={() => saveProducto(item)}>
                            <Save size={15} /> Guardar
                          </button>
                          <button type="button" className="danger-btn" onClick={() => deleteProducto(item.id)}>
                            <Trash2 size={15} /> Eliminar
                          </button>
                        </div>
                      </article>
                    ))}
                    {!loading && filteredProductos.length === 0 && (
                      <div className="empty-state">
                        <strong>Sin coincidencias en productos</strong>
                        <p>Ajusta el filtro o crea un nuevo registro.</p>
                      </div>
                    )}
                  </div>
                </article>

                <article className="card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Ingredientes</p>
                      <h2>Abastecimiento y umbrales</h2>
                    </div>
                    <span className="section-badge">{filteredIngredientes.length} visibles</span>
                  </div>

                  <form className="inventory-form catalog-create-form" onSubmit={createIngrediente}>
                    <label>
                      Nombre
                      <input type="text" required placeholder="Queso mozzarella" value={ingredienteForm.nombre} onChange={(e) => setIngredienteForm((prev) => ({ ...prev, nombre: e.target.value }))} />
                    </label>
                    <label>
                      Unidad
                      <input type="text" required placeholder="porcion" value={ingredienteForm.unidad} onChange={(e) => setIngredienteForm((prev) => ({ ...prev, unidad: e.target.value }))} />
                    </label>
                    <label>
                      Stock actual
                      <input type="number" step="0.01" required value={ingredienteForm.stock_actual} onChange={(e) => setIngredienteForm((prev) => ({ ...prev, stock_actual: e.target.value }))} />
                    </label>
                    <label>
                      Stock minimo
                      <input type="number" step="0.01" required value={ingredienteForm.stock_minimo} onChange={(e) => setIngredienteForm((prev) => ({ ...prev, stock_minimo: e.target.value }))} />
                    </label>
                    <button type="submit">
                      <PlusCircle size={16} /> Crear ingrediente
                    </button>
                  </form>

                  <div className="catalog-editor-grid">
                    {filteredIngredientes.map((item) => (
                      <article key={item.id} className={`catalog-item-card ${item.bajo_minimo ? 'is-alert' : ''}`}>
                        <div className="catalog-item-card__head">
                          <div>
                            <p className="section-kicker">Ingrediente</p>
                            <h3>{item.nombre}</h3>
                          </div>
                          <span className={`catalog-status ${item.bajo_minimo ? 'is-alert' : 'is-active'}`}>{item.bajo_minimo ? 'Bajo minimo' : 'Estable'}</span>
                        </div>

                        <div className="catalog-metric-row">
                          <div>
                            <span>Stock actual</span>
                            <strong>
                              {item.stock_actual} {item.unidad}
                            </strong>
                          </div>
                          <div>
                            <span>Minimo</span>
                            <strong>{item.stock_minimo}</strong>
                          </div>
                        </div>

                        <div className="catalog-fields">
                          <label>
                            <span>Nombre</span>
                            <input type="text" value={item.nombre} onChange={(e) => updateIngredienteField(item.id, 'nombre', e.target.value)} />
                          </label>
                          <label>
                            <span>Unidad</span>
                            <input type="text" value={item.unidad} onChange={(e) => updateIngredienteField(item.id, 'unidad', e.target.value)} />
                          </label>
                          <label>
                            <span>Stock actual</span>
                            <input type="number" step="0.01" value={item.stock_actual} onChange={(e) => updateIngredienteField(item.id, 'stock_actual', e.target.value)} />
                          </label>
                          <label>
                            <span>Stock minimo</span>
                            <input type="number" step="0.01" value={item.stock_minimo} onChange={(e) => updateIngredienteField(item.id, 'stock_minimo', e.target.value)} />
                          </label>
                        </div>

                        <div className="catalog-item-card__footer">
                          <button type="button" onClick={() => saveIngrediente(item)}>
                            <Save size={15} /> Guardar
                          </button>
                          <button type="button" className="danger-btn" onClick={() => deleteIngrediente(item.id)}>
                            <Trash2 size={15} /> Eliminar
                          </button>
                        </div>
                      </article>
                    ))}
                    {!loading && filteredIngredientes.length === 0 && (
                      <div className="empty-state">
                        <strong>Sin coincidencias en ingredientes</strong>
                        <p>Revisa el texto del filtro o registra un nuevo insumo.</p>
                      </div>
                    )}
                  </div>
                </article>

                <article className="card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Mesas</p>
                      <h2>Disponibilidad operativa</h2>
                    </div>
                    <span className="section-badge">{filteredMesas.length} visibles</span>
                  </div>

                  <form className="inventory-form catalog-create-form" onSubmit={createMesa}>
                    <label>
                      Numero de mesa
                      <input type="number" min="1" required placeholder="11" value={mesaForm.numero_mesa} onChange={(e) => setMesaForm((prev) => ({ ...prev, numero_mesa: e.target.value }))} />
                    </label>
                    <label>
                      Estado
                      <select value={mesaForm.estado} onChange={(e) => setMesaForm((prev) => ({ ...prev, estado: e.target.value }))}>
                        {MESA_STATES.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit">
                      <PlusCircle size={16} /> Crear mesa
                    </button>
                  </form>

                  <div className="catalog-editor-grid catalog-editor-grid--compact">
                    {filteredMesas.map((item) => (
                      <article key={item.id} className="catalog-item-card">
                        <div className="catalog-item-card__head">
                          <div>
                            <p className="section-kicker">Mesa</p>
                            <h3>Mesa {item.numero_mesa}</h3>
                          </div>
                          <span className={`catalog-status ${item.estado === 'ocupada' ? 'is-alert' : 'is-active'}`}>{item.estado}</span>
                        </div>

                        <div className="catalog-fields catalog-fields--compact">
                          <label>
                            <span>Numero</span>
                            <input type="number" min="1" value={item.numero_mesa} onChange={(e) => updateMesaField(item.id, 'numero_mesa', e.target.value)} />
                          </label>
                          <label>
                            <span>Estado</span>
                            <select value={item.estado} onChange={(e) => updateMesaField(item.id, 'estado', e.target.value)}>
                              {MESA_STATES.map((state) => (
                                <option key={state} value={state}>
                                  {state}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="catalog-item-card__footer">
                          <button type="button" onClick={() => saveMesa(item)}>
                            <Save size={15} /> Guardar
                          </button>
                          <button type="button" className="danger-btn" onClick={() => deleteMesa(item.id)}>
                            <Trash2 size={15} /> Eliminar
                          </button>
                        </div>
                      </article>
                    ))}
                    {!loading && filteredMesas.length === 0 && (
                      <div className="empty-state">
                        <strong>Sin coincidencias en mesas</strong>
                        <p>Prueba otro filtro o agrega una nueva mesa.</p>
                      </div>
                    )}
                  </div>
                </article>
              </section>
            </>
          )}

          {activeModule === 'auditoria' && (
            <section className="admin-grid">
              <article className="card">
                <div className="content-head">
                  <div>
                    <p className="section-kicker">Auditoria</p>
                    <h2>
                      <History size={20} /> Historial de cambios
                    </h2>
                  </div>
                  <span className="section-badge">{acciones.length} acciones</span>
                </div>
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
                      <button type="button" className="action-btn" onClick={() => undoAction(accion.id)} disabled={accion.deshecha || actionBusyId === accion.id}>
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
