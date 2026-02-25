import { Minus, Plus } from 'lucide-react';
import { money } from '../utils/format';

function ProductCard({ product, quantity, onAdd, onRemove }) {
  return (
    <article className="product-card">
      <h3>{product.nombre}</h3>
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