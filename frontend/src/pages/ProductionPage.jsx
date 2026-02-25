import { useCallback, useEffect, useState } from 'react';
import { Clock3, Flame, CheckCircle2, ChefHat } from 'lucide-react';
import client from '../api/client';
import { money } from '../utils/format';
import StatusBadge from '../components/StatusBadge';

function ProductionPage() {
  const [data, setData] = useState({ kpis: { total: 0, urgentes: 0, en_horno: 0, listos: 0 }, pedidos: [] });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await client.get('/produccion/tablero/');
      setData(data);
      setError('');
    } catch {
      setError('No se pudo consultar el tablero de produccion.');
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
      setBusyId(pedidoId);
      await client.post(`/pedidos/${pedidoId}/confirmar-insumos/`, {});
      await load();
    } catch (err) {
      const faltantes = err?.response?.data?.faltantes;
      setError(
        faltantes ? `Stock insuficiente: ${faltantes.join(', ')}` : 'No se pudieron confirmar los insumos.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = async (pedidoId, estado) => {
    try {
      setBusyId(pedidoId);
      await client.post(`/pedidos/${pedidoId}/estado/`, { estado });
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo actualizar el estado del pedido.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="screen">
      <section className="hero hero-orange">
        <h1>Area de produccion</h1>
        <p>Gestiona y da seguimiento al estado de cada orden</p>
      </section>

      <section className="prod-tabs">
        <button type="button">Orden cliente</button>
        <button type="button">Recepcion</button>
        <button type="button" className="active">
          Produccion
        </button>
      </section>

      {error && <p className="error-box">{error}</p>}

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

      <section className="table-wrap">
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
            {!loading && data.pedidos.length === 0 && (
              <tr>
                <td colSpan={7}>No hay ordenes activas por el momento.</td>
              </tr>
            )}

            {data.pedidos.map((pedido) => (
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
                  {pedido.estado === 'pendiente' && !pedido.insumos_confirmados && (
                    <button
                      type="button"
                      className="action-btn action-yellow"
                      onClick={() => confirmInputs(pedido.id)}
                      disabled={busyId === pedido.id}
                    >
                      Confirmar insumos
                    </button>
                  )}
                  {pedido.estado === 'pendiente' && pedido.insumos_confirmados && (
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => changeStatus(pedido.id, 'en_horno')}
                      disabled={busyId === pedido.id}
                    >
                      Mover a horno
                    </button>
                  )}
                  {pedido.estado === 'en_horno' && (
                    <button
                      type="button"
                      className="action-btn action-green"
                      onClick={() => changeStatus(pedido.id, 'listo')}
                      disabled={busyId === pedido.id}
                    >
                      Marcar listo
                    </button>
                  )}
                  {pedido.estado === 'listo' && <span className="ready-text">Listo para entregar</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="status-guide">
        <h3>Guia de estados</h3>
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
      </section>
    </main>
  );
}

export default ProductionPage;