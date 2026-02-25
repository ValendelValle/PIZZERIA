import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Boxes, PlusCircle } from 'lucide-react';
import client from '../api/client';
import { money } from '../utils/format';

function AdminPage() {
  const [periodo, setPeriodo] = useState('todo');
  const [top, setTop] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [form, setForm] = useState({ ingrediente_id: '', cantidad: '', observacion: '' });
  const [error, setError] = useState('');

  const loadData = async (currentPeriodo = periodo) => {
    try {
      const [rep, ing, mov] = await Promise.all([
        client.get(`/reportes/top-productos/?periodo=${currentPeriodo}`),
        client.get('/inventario/ingredientes/'),
        client.get('/inventario/movimientos/'),
      ]);
      setTop(rep.data.top_productos || []);
      setIngredientes(ing.data || []);
      setMovimientos(mov.data || []);
      setError('');

      if (!form.ingrediente_id && ing.data?.length > 0) {
        setForm((prev) => ({ ...prev, ingrediente_id: String(ing.data[0].id) }));
      }
    } catch {
      setError('No se pudo cargar la informacion del panel admin.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePeriodo = (newPeriodo) => {
    setPeriodo(newPeriodo);
    loadData(newPeriodo);
  };

  const submitEntrada = async (e) => {
    e.preventDefault();
    try {
      await client.post('/inventario/entradas/', {
        ingrediente_id: Number(form.ingrediente_id),
        cantidad: Number(form.cantidad),
        observacion: form.observacion,
      });
      setForm((prev) => ({ ...prev, cantidad: '', observacion: '' }));
      await loadData();
    } catch {
      setError('No se pudo registrar la entrada de inventario.');
    }
  };

  return (
    <main className="screen">
      <section className="hero hero-dark">
        <h1>Panel administrativo</h1>
        <p>Inventario de materia prima y productos mas vendidos</p>
      </section>

      {error && <p className="error-box">{error}</p>}

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
            {top.length === 0 && <p>Sin ventas registradas para este periodo.</p>}
          </div>
        </article>

        <article className="card">
          <h2>
            <Boxes size={20} /> Entradas de inventario
          </h2>
          <form className="inventory-form" onSubmit={submitEntrada}>
            <label>
              Ingrediente
              <select
                value={form.ingrediente_id}
                onChange={(e) => setForm((prev) => ({ ...prev, ingrediente_id: e.target.value }))}
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
                value={form.cantidad}
                onChange={(e) => setForm((prev) => ({ ...prev, cantidad: e.target.value }))}
              />
            </label>
            <label>
              Observacion
              <input
                type="text"
                value={form.observacion}
                onChange={(e) => setForm((prev) => ({ ...prev, observacion: e.target.value }))}
              />
            </label>
            <button type="submit">
              <PlusCircle size={16} /> Registrar entrada
            </button>
          </form>
        </article>
      </section>

      <section className="admin-grid">
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
            {movimientos.slice(0, 12).map((mov) => (
              <div key={mov.id}>
                <strong>{mov.tipo.toUpperCase()}</strong>
                <span>{mov.ingrediente_nombre}</span>
                <span>{mov.cantidad}</span>
              </div>
            ))}
            {movimientos.length === 0 && <p>No hay movimientos registrados.</p>}
          </div>
        </article>
      </section>
    </main>
  );
}

export default AdminPage;