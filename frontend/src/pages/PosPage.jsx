import { useEffect, useMemo, useState } from 'react';
import { Clock3, ReceiptText, ShieldCheck, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import CategoryTabs from '../components/CategoryTabs';
import ProductCard from '../components/ProductCard';
import OrderSidebar from '../components/OrderSidebar';

const LABELS = {
  pizza: 'Pizzas',
  bebida: 'Bebidas',
  postre: 'Postres',
  combo: 'Combos',
};

function PosPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState({});
  const [mesas, setMesas] = useState([]);
  const [tipoEntrega, setTipoEntrega] = useState('llevar');
  const [mesaId, setMesaId] = useState('');
  const [activeType, setActiveType] = useState('pizza');
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const { data } = await client.get('/catalogo/');
        setCatalog(data.productos || {});
        setMesas(data.mesas || []);

        const primeraMesaLibre = (data.mesas || []).find((mesa) => mesa.estado === 'libre');
        if (primeraMesaLibre) {
          setMesaId(String(primeraMesaLibre.id));
        }

        const firstType = Object.keys(data.productos || {}).find(
          (key) => Array.isArray(data.productos[key]) && data.productos[key].length > 0
        );
        if (firstType) {
          setActiveType(firstType);
        }
      } catch (err) {
        const detail = err?.response?.data?.detail;
        setError(detail || 'No se pudo cargar el catalogo. Revisa que el backend y base de datos esten activos.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const categories = useMemo(
    () =>
      Object.entries(catalog)
        .filter(([, value]) => Array.isArray(value) && value.length > 0)
        .map(([key, value]) => ({ key, label: LABELS[key] || key, count: value.length })),
    [catalog]
  );

  const productMap = useMemo(() => {
    const map = {};
    Object.values(catalog).forEach((list) => {
      (list || []).forEach((product) => {
        map[product.id] = product;
      });
    });
    return map;
  }, [catalog]);

  const currentProducts = catalog[activeType] || [];
  const mesasLibres = useMemo(() => mesas.filter((mesa) => mesa.estado === 'libre'), [mesas]);
  const selectedMesa = useMemo(
    () => mesas.find((mesa) => String(mesa.id) === String(mesaId)),
    [mesas, mesaId]
  );

  const orderItems = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const product = productMap[id];
        return {
          id: product.id,
          nombre: product.nombre,
          precio: Number(product.precio),
          cantidad: qty,
          subtotal: Number(product.precio) * qty,
        };
      });
  }, [cart, productMap]);

  const subtotal = useMemo(() => orderItems.reduce((acc, item) => acc + item.subtotal, 0), [orderItems]);
  const impuesto = subtotal * 0.16;
  const total = subtotal + impuesto;
  const totalItems = useMemo(() => orderItems.reduce((acc, item) => acc + item.cantidad, 0), [orderItems]);

  const addItem = (productId) => {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  };

  const removeItem = (productId) => {
    setCart((prev) => ({ ...prev, [productId]: Math.max((prev[productId] || 0) - 1, 0) }));
  };

  const handlePay = async () => {
    try {
      setProcessing(true);
      setError('');

      if (tipoEntrega === 'mesa' && !mesaId) {
        setError('Selecciona una mesa libre o cambia a para llevar.');
        return;
      }

      const payload = {
        mesa_id: tipoEntrega === 'mesa' && mesaId ? Number(mesaId) : null,
        items: orderItems.map((item) => ({ producto_id: item.id, cantidad: item.cantidad })),
      };

      const { data } = await client.post('/pedidos/', payload);
      setCart({});
      navigate(`/ticket/${data.folio}`);
    } catch (err) {
      const detail = Array.isArray(err?.response?.data)
        ? String(err.response.data[0])
        : err?.response?.data?.detail || 'No se pudo crear el pedido.';
      setError(detail);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="screen pos-screen">
      <section className="hero hero-red">
        <div className="hero__grid">
          <div className="hero__content">
            <p className="hero__eyebrow">Publico / clientes</p>
            <h1>Ordena, paga y recibe tu ticket digital en MXN.</h1>
            <p>Flujo de autoservicio para pizzeria escolar con seleccion rapida, tipo de entrega claro y ticket QR.</p>
          </div>

          <div className="hero__stats">
            <article className="hero-stat">
              <span>Productos activos</span>
              <strong>{Object.values(catalog).flat().length}</strong>
            </article>
            <article className="hero-stat">
              <span>Mesas libres</span>
              <strong>{mesasLibres.length}</strong>
            </article>
            <article className="hero-stat">
              <span>Carrito actual</span>
              <strong>{totalItems} items</strong>
            </article>
          </div>
        </div>
      </section>

      <section className="pos-trust">
        <p>
          <ShieldCheck size={16} /> Pago simulado seguro
        </p>
        <p>
          <ReceiptText size={16} /> Ticket digital sin impresion
        </p>
        <p>
          <Store size={16} /> Entrega en mesa o para llevar
        </p>
        <p>
          <Clock3 size={16} /> Flujo rapido para mostrador
        </p>
      </section>

      {error && <p className="error-box">{error}</p>}

      <section className="pos-layout">
        <div className="pos-main">
          <section className="card pos-intro-card">
            <div className="content-head">
              <div>
                <p className="section-kicker">Configuracion de pedido</p>
                <h2>Selecciona tipo de entrega y prepara tu orden</h2>
              </div>
              <span className="section-badge">Todos los montos en MXN</span>
            </div>

            <div className="pos-flow-grid">
              <div className="mesa-card">
                <label htmlFor="tipo-entrega">Tipo de pedido</label>
                <select id="tipo-entrega" value={tipoEntrega} onChange={(e) => setTipoEntrega(e.target.value)}>
                  <option value="llevar">Para llevar</option>
                  <option value="mesa">Consumir en mesa</option>
                </select>

                {tipoEntrega === 'mesa' && (
                  <label htmlFor="mesa-select">
                    Mesa libre
                    <select id="mesa-select" value={mesaId} onChange={(e) => setMesaId(e.target.value)}>
                      <option value="">Selecciona una mesa</option>
                      {mesasLibres.map((mesa) => (
                        <option key={mesa.id} value={mesa.id}>
                          Mesa {mesa.numero_mesa}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="pos-delivery-summary">
                <article>
                  <strong>{tipoEntrega === 'mesa' ? 'Servicio en mesa' : 'Recolectar en mostrador'}</strong>
                  <p>{tipoEntrega === 'mesa' ? selectedMesa ? `Mesa ${selectedMesa.numero_mesa} confirmada.` : 'Selecciona una mesa disponible.' : 'No requiere asignacion de mesa.'}</p>
                </article>
                <article>
                  <strong>Catalogo listo</strong>
                  <p>{categories.length} categorias activas y {Object.values(catalog).flat().length} productos disponibles.</p>
                </article>
              </div>
            </div>
          </section>

          <section className="card pos-menu-card">
            <div className="content-head">
              <div>
                <p className="section-kicker">Menu disponible</p>
                <h2>{LABELS[activeType] || 'Selecciona una categoria'}</h2>
              </div>
              <span className="section-badge">{currentProducts.length} resultados</span>
            </div>

            <CategoryTabs categories={categories} active={activeType} onChange={setActiveType} />

            {loading && (
              <div className="empty-state">
                <strong>Cargando menu</strong>
                <p>Consultando productos y mesas disponibles desde el backend.</p>
              </div>
            )}

            {!loading && currentProducts.length === 0 && (
              <div className="empty-state">
                <strong>Sin productos en esta categoria</strong>
                <p>Cambia de categoria o revisa el catalogo administrativo.</p>
              </div>
            )}

            {!loading && currentProducts.length > 0 && (
              <div className="product-grid">
                {currentProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={cart[product.id] || 0}
                    onAdd={addItem}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <OrderSidebar
          items={orderItems}
          subtotal={subtotal}
          impuesto={impuesto}
          total={total}
          onPay={handlePay}
          processing={processing}
          tipoEntrega={tipoEntrega}
          mesaLabel={tipoEntrega === 'mesa' && selectedMesa ? `Mesa ${selectedMesa.numero_mesa}` : 'Mostrador'}
        />
      </section>
    </main>
  );
}

export default PosPage;
