import { Pizza, CupSoda, IceCreamBowl, Package2 } from 'lucide-react';

const ICON_BY_TYPE = {
  pizza: Pizza,
  bebida: CupSoda,
  postre: IceCreamBowl,
  combo: Package2,
};

function CategoryTabs({ categories, active, onChange }) {
  return (
    <div className="category-tabs">
      {categories.map((cat) => {
        const Icon = ICON_BY_TYPE[cat.key] || Package2;
        return (
          <button
            key={cat.key}
            className={`category-tabs__btn ${active === cat.key ? 'is-active' : ''}`}
            onClick={() => onChange(cat.key)}
            type="button"
          >
            <span className="category-tabs__icon">
              <Icon size={18} />
            </span>
            <span>
              {cat.label}
              {typeof cat.count === 'number' && <small>{cat.count} disponibles</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default CategoryTabs;
