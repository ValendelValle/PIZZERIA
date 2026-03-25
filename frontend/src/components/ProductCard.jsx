import { Minus, Plus } from 'lucide-react';
import { money } from '../utils/format';

const PRODUCT_META = {
  pizza: { tag: 'Pizza', detail: '12-15 min', note: 'Horneada al momento' },
  bebida: { tag: 'Bebida', detail: 'Lista al instante', note: 'Ideal para combo' },
  postre: { tag: 'Postre', detail: 'Entrega rapida', note: 'Cierre dulce del pedido' },
  combo: { tag: 'Combo', detail: 'Ahorro del menu', note: 'Solucion completa' },
};

function ProductCard({ product, quantity, onAdd, onRemove }) {
  const meta = PRODUCT_META[product.tipo] || { tag: 'Menu', detail: 'Disponible', note: 'Listo para ordenar' };

  return (
    <article className="product-card">
      <div className="product-card__top">
        <span className="product-card__tag">{meta.tag}</span>
        <span className="product-card__qty">{quantity} en orden</span>
      </div>
      <h3>{product.nombre}</h3>
      <p className="product-card__description">{meta.note}. Servicio disponible en mostrador o mesa.</p>
      <div className="product-card__meta">
        <span>{meta.detail}</span>
        <span>{money(product.precio)}</span>
      </div>
      <p className="price">{money(product.precio)}</p>
      <div className="counter-row">
        <button type="button" onClick={() => onRemove(product.id)} disabled={quantity === 0}>
          <Minus size={18} />
        </button>
        <span>{quantity}</span>
        <button type="button" onClick={() => onAdd(product.id)}>
          <Plus size={18} />
        </button>
      </div>
    </article>
  );
}

export default ProductCard;
