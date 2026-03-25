import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChefHat, ClipboardList, Clock3, Flame, History, Layers } from 'lucide-react';
import client from '../api/client';
import { money } from '../utils/format';
import PanelSidebar from '../components/PanelSidebar';
import StatusBadge from '../components/StatusBadge';

function ProductionPage() {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [data, setData] = useState({ kpis: { total: 0, urgentes: 0, en_horno: 0, listos: 0 }, pedidos: [] });
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
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
      setLastUpdated(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
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
  const pedidosEnHorno = useMemo(
    () => data.pedidos.filter((pedido) => pedido.estado === 'en_horno'),
    [data.pedidos]
  );
  const moduleItems = useMemo(
    () => [
      { key: 'dashboard', label: 'Dashboard', icon: Layers, meta: `${data.kpis.total || 0} activos` },
      { key: 'ordenes', label: 'Ordenes cliente', icon: ClipboardList, meta: `${pedidosPendientes.length} pendientes` },
      { key: 'recepcion', label: 'Recepcion', icon: CheckCircle2, meta: `${pedidosListos.length} listos` },
      { key: 'historial', label: 'Historial', icon: History, meta: `${historial.length} registros` },
    ],
    [data.kpis.total, pedidosPendientes.length, pedidosListos.length, historial.length]
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
        <div className="hero__grid">
          <div className="hero__content">
            <p className="hero__eyebrow">Staff / produccion</p>
            <h1>Operacion de cocina con foco en estados, tiempos y entrega.</h1>
            <p>Cola operativa para recibir pedidos, confirmar insumos, avanzar produccion y entregar sin perder trazabilidad.</p>
          </div>

          <div className="hero__stats">
            <article className="hero-stat">
              <span>Pedidos activos</span>
              <strong>{data.kpis.total}</strong>
            </article>
            <article className="hero-stat">
              <span>En espera</span>
              <strong>{data.kpis.urgentes}</strong>
            </article>
            <article className="hero-stat">
              <span>Listos</span>
              <strong>{data.kpis.listos}</strong>
            </article>
          </div>
        </div>
      </section>

      <section className="panel-layout">
        <PanelSidebar
          title="Produccion"
          subtitle="Gestion operativa"
          items={moduleItems}
          activeKey={activeModule}
          onChange={setActiveModule}
          footer={
            <div className="sidebar-note">
              <strong>Refresco automatico</strong>
              <p>{lastUpdated ? `Ultima actualizacion: ${lastUpdated}` : 'Consultando tablero...'}.</p>
            </div>
          }
        />

        <section className="panel-content">
          {error && <p className="error-box panel-msg">{error}</p>}

          {activeModule === 'dashboard' && (
            <>
              <section className="card ops-note">
                <div className="content-head">
                  <div>
                    <p className="section-kicker">Resumen operativo</p>
                    <h2>Prioriza pendientes, horno y entrega</h2>
                  </div>
                  <span className="section-badge">Actualiza cada 10 segundos</span>
                </div>
                <p>
                  Los pedidos pendientes requieren confirmacion de insumos antes de entrar a horno. Los pedidos listos deben entregarse o liberar mesa cuanto antes.
                </p>
              </section>

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

              <section className="queue-grid">
                <article className="card queue-card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Cola inmediata</p>
                      <h2>Pendientes</h2>
                    </div>
                    <span className="section-badge">{pedidosPendientes.length}</span>
                  </div>
                  {pedidosPendientes.length === 0 ? (
                    <div className="empty-state">
                      <strong>Sin pendientes</strong>
                      <p>No hay pedidos esperando confirmacion.</p>
                    </div>
                  ) : (
                    <div className="queue-card__list">
                      {pedidosPendientes.slice(0, 5).map((pedido) => (
                        <div key={`pending-${pedido.id}`} className="queue-pill">
                          <strong>{pedido.folio}</strong>
                          <span>{pedido.tiempo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                <article className="card queue-card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">En proceso</p>
                      <h2>Horno</h2>
                    </div>
                    <span className="section-badge">{pedidosEnHorno.length}</span>
                  </div>
                  {pedidosEnHorno.length === 0 ? (
                    <div className="empty-state">
                      <strong>Sin pedidos en horno</strong>
                      <p>La cola de preparacion esta despejada.</p>
                    </div>
                  ) : (
                    <div className="queue-card__list">
                      {pedidosEnHorno.slice(0, 5).map((pedido) => (
                        <div key={`oven-${pedido.id}`} className="queue-pill queue-pill--oven">
                          <strong>{pedido.folio}</strong>
                          <span>{pedido.tiempo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                <article className="card queue-card">
                  <div className="content-head">
                    <div>
                      <p className="section-kicker">Entrega</p>
                      <h2>Listos</h2>
                    </div>
                    <span className="section-badge">{pedidosListos.length}</span>
                  </div>
                  {pedidosListos.length === 0 ? (
                    <div className="empty-state">
                      <strong>Sin ordenes listas</strong>
                      <p>Cuando un pedido termine aparecera aqui.</p>
                    </div>
                  ) : (
                    <div className="queue-card__list">
                      {pedidosListos.slice(0, 5).map((pedido) => (
                        <div key={`ready-${pedido.id}`} className="queue-pill queue-pill--ready">
                          <strong>{pedido.folio}</strong>
                          <span>{pedido.mesa ? `Mesa ${pedido.mesa}` : 'Mostrador'}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
