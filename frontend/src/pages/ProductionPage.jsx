import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChefHat, ClipboardList, Clock3, Flame, History, Layers } from 'lucide-react';
import client from '../api/client';
import { money } from '../utils/format';
import PanelSidebar from '../components/PanelSidebar';
import StatusBadge from '../components/StatusBadge';

const MODULES = [
  { key: 'dashboard', label: 'Dashboard', icon: Layers },
  { key: 'ordenes', label: 'Ordenes cliente', icon: ClipboardList },
  { key: 'recepcion', label: 'Recepcion', icon: CheckCircle2 },
  { key: 'historial', label: 'Historial', icon: History },
];

function ProductionPage() {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [data, setData] = useState({ kpis: { total: 0, urgentes: 0, en_horno: 0, listos: 0 }, pedidos: [] });
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [tableroResp, historialResp] = await Promise.all([
        client.get('/produccion/tablero/'),
        client.get('/pedidos/historial/'),
      ]);
      setData(tableroResp.data);
      setHistorial((historialResp.data || []).slice(0, 20));
      setError('');
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo consultar el modulo de produccion.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const confirmInputs = async (pedidoId) => {
    try {
      setBusyKey(`insumos-${pedidoId}`);
      await client.post(`/pedidos/${pedidoId}/confirmar-insumos/`, {});
      await load();
    } catch (err) {
      const faltantes = err?.response?.data?.faltantes;
      setError(
        faltantes ? `Stock insuficiente: ${faltantes.join(', ')}` : 'No se pudieron confirmar los insumos.'
      );
    } finally {
      setBusyKey('');
    }
  };

  const changeStatus = async (pedidoId, estado) => {
    try {
      setBusyKey(`estado-${pedidoId}`);
      await client.post(`/pedidos/${pedidoId}/estado/`, { estado });
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo actualizar el estado del pedido.');
    } finally {
      setBusyKey('');
    }
  };

  const liberarMesa = async (mesaId) => {
    try {
      setBusyKey(`mesa-${mesaId}`);
      await client.post(`/mesas/${mesaId}/liberar/`, {});
      await load();
    } catch {
      setError('No se pudo liberar la mesa.');
    } finally {
      setBusyKey('');
    }
  };

  const pedidosPendientes = useMemo(
    () => data.pedidos.filter((pedido) => pedido.estado === 'pendiente'),
    [data.pedidos]
  );
  const pedidosListos = useMemo(
    () => data.pedidos.filter((pedido) => pedido.estado === 'listo'),
    [data.pedidos]
  );

  const renderOrdersTable = (orders, mode = 'full') => (
    <table className="production-table">
      <thead>
        <tr>
          <th>Ticket ID</th>
          <th>Mesa</th>
          <th>Items</th>
          <th>Total</th>
          <th>Tiempo</th>
          <th>Status</th>
          <th>Accion</th>
        </tr>
      </thead>
      <tbody>
        {!loading && orders.length === 0 && (
          <tr>
            <td colSpan={7}>Sin ordenes para este modulo.</td>
          </tr>
        )}

        {orders.map((pedido) => (
          <tr key={pedido.id}>
            <td>{pedido.folio}</td>
            <td>{pedido.mesa ? `Mesa ${pedido.mesa}` : 'Mostrador'}</td>
            <td>
              <ul className="inline-items">
                {pedido.items.map((item, idx) => (
                  <li key={`${pedido.id}-${idx}`}>
                    {item.cantidad}x {item.nombre}
                  </li>
                ))}
              </ul>
            </td>
            <td>{money(pedido.total)}</td>
            <td>
              <span className="time-chip">
                <Clock3 size={16} />
                {pedido.tiempo}
              </span>
            </td>
            <td>
              <StatusBadge status={pedido.estado} />
            </td>
            <td>
              {mode !== 'recepcion' && pedido.estado === 'pendiente' && !pedido.insumos_confirmados && (
                <button
                  type="button"
                  className="action-btn action-yellow"
                  onClick={() => confirmInputs(pedido.id)}
                  disabled={busyKey === `insumos-${pedido.id}`}
                >
                  Confirmar insumos
                </button>
              )}

              {mode !== 'recepcion' && pedido.estado === 'pendiente' && pedido.insumos_confirmados && (
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => changeStatus(pedido.id, 'en_horno')}
                  disabled={busyKey === `estado-${pedido.id}`}
                >
                  Mover a horno
                </button>
              )}

              {mode !== 'recepcion' && pedido.estado === 'en_horno' && (
                <button
                  type="button"
                  className="action-btn action-green"
                  onClick={() => changeStatus(pedido.id, 'listo')}
                  disabled={busyKey === `estado-${pedido.id}`}
                >
                  Marcar listo
                </button>
              )}

              {pedido.estado === 'listo' && (
                <div className="ready-actions">
                  <span className="ready-text">Listo para entregar</span>
                  {pedido.mesa && (
                    <button
                      type="button"
                      className="action-btn action-dark"
                      onClick={() => liberarMesa(pedido.mesa)}
                      disabled={busyKey === `mesa-${pedido.mesa}`}
                    >
                      Liberar mesa
                    </button>
                  )}
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <main className="screen prod-screen">
      <section className="hero hero-orange">
        <h1>Panel de Produccion</h1>
        <p>Operacion segmentada por modulo: ordenes, recepcion e historial</p>
      </section>

      <section className="panel-layout">
        <PanelSidebar
          title="Produccion"
          subtitle="Gestion operativa"
          items={MODULES}
          activeKey={activeModule}
          onChange={setActiveModule}
        />

        <section className="panel-content">
          {error && <p className="error-box panel-msg">{error}</p>}

          {activeModule === 'dashboard' && (
            <>
              <section className="kpi-grid">
                <article className="kpi-card">
                  <p>Total Ordenes</p>
                  <strong>{data.kpis.total}</strong>
                </article>
                <article className="kpi-card urgent">
                  <p>Urgentes</p>
                  <strong>{data.kpis.urgentes}</strong>
                </article>
                <article className="kpi-card oven">
                  <p>En horno</p>
                  <strong>{data.kpis.en_horno}</strong>
                </article>
                <article className="kpi-card ready">
                  <p>Listos</p>
                  <strong>{data.kpis.listos}</strong>
                </article>
              </section>

              <section className="table-wrap panel-card-wrap">
                <article className="card">
                  <h2>Produccion activa</h2>
                  {renderOrdersTable(data.pedidos, 'full')}
                </article>
              </section>
            </>
          )}

          {activeModule === 'ordenes' && (
            <section className="table-wrap panel-card-wrap">
              <article className="card">
                <h2>Ordenes del cliente pendientes</h2>
                {renderOrdersTable(pedidosPendientes, 'ordenes')}
              </article>
            </section>
          )}

          {activeModule === 'recepcion' && (
            <section className="table-wrap panel-card-wrap">
              <article className="card">
                <h2>Recepcion y entrega</h2>
                {renderOrdersTable(pedidosListos, 'recepcion')}
              </article>
            </section>
          )}

          {activeModule === 'historial' && (
            <section className="panel-card-wrap">
              <article className="card">
                <h2>Historial reciente</h2>
                <div className="simple-table">
                  {historial.map((pedido) => (
                    <div key={`hist-${pedido.id}`}>
                      <strong>{pedido.folio}</strong>
                      <span>{pedido.estado}</span>
                      <span>{pedido.mesa_numero ? `Mesa ${pedido.mesa_numero}` : 'Llevar'}</span>
                    </div>
                  ))}
                  {!loading && historial.length === 0 && <p>No hay historial disponible.</p>}
                </div>
              </article>

              <article className="card">
                <h2>Guia de estados</h2>
                <div>
                  <p>
                    <Flame size={18} /> Urgente: pedido recien recibido, necesita atencion.
                  </p>
                  <p>
                    <ChefHat size={18} /> En horno: orden en preparacion activa.
                  </p>
                  <p>
                    <CheckCircle2 size={18} /> Listo: pedido terminado y listo para entrega.
                  </p>
                </div>
              </article>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

export default ProductionPage;
