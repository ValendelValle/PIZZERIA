import { ShoppingCart } from 'lucide-react';
import { money } from '../utils/format';

function OrderSidebar({ items, total, subtotal, impuesto, onPay, processing, tipoEntrega, mesaLabel }) {
  const totalItems = items.reduce((acc, item) => acc + item.cantidad, 0);

  return (
    <aside className="order-sidebar">
      <div className="order-sidebar__head">
        <div>
          <p className="section-kicker">Pedido actual</p>
          <h2>
            <ShoppingCart size={24} />
            Resumen de compra
          </h2>
        </div>
        <span className="order-sidebar__badge">{totalItems} articulos</span>
      </div>

      <div className="order-sidebar__meta">
        <span>{tipoEntrega === 'mesa' ? 'Consumo en mesa' : 'Para llevar'}</span>
        <span>{mesaLabel || 'Mostrador'}</span>
      </div>

      {items.length === 0 ? (
        <div className="order-sidebar__empty">
          <strong>Tu carrito esta vacio</strong>
          <p>Agrega pizzas, bebidas o combos para habilitar el pago simulado.</p>
        </div>
      ) : (
        <div className="order-sidebar__list">
          {items.map((item) => (
            <div key={item.id} className="line-item">
              <div>
                <strong>{item.nombre}</strong>
                <p>
                  {item.cantidad} x {money(item.precio)}
                </p>
              </div>
              <span>{money(item.subtotal)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="order-sidebar__totals">
        <div>
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        <div>
          <span>Impuesto</span>
          <span>{money(impuesto)}</span>
        </div>
        <div className="total-row">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
      </div>

      <button className="pay-btn" type="button" onClick={onPay} disabled={processing || items.length === 0}>
        {processing ? 'Procesando...' : 'Completar pago'}
      </button>
    </aside>
  );
}

export default OrderSidebar;
