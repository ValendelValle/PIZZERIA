import { ShoppingCart } from 'lucide-react';
import { money } from '../utils/format';

function OrderSidebar({ items, total, subtotal, impuesto, onPay, processing }) {
  return (
    <aside className="order-sidebar">
      <h2>
        <ShoppingCart size={24} />
        Orden actual
      </h2>

      {items.length === 0 ? (
        <p className="order-sidebar__empty">No hay productos en la orden</p>
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