function PanelSidebar({ title, subtitle, items, activeKey, onChange, footer }) {
  return (
    <aside className="panel-sidebar">
      <div className="panel-sidebar__head">
        <span className="panel-sidebar__eyebrow">Modulo interno</span>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <nav className="panel-sidebar__nav">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={`panel-nav-btn ${active ? 'is-active' : ''}`}
              onClick={() => onChange(item.key)}
            >
              <span className="panel-nav-btn__main">
                {Icon && <Icon size={16} />}
                {item.label}
              </span>
              {item.meta && <span className="panel-nav-btn__meta">{item.meta}</span>}
            </button>
          );
        })}
      </nav>

      {footer && <div className="panel-sidebar__footer">{footer}</div>}
    </aside>
  );
}

export default PanelSidebar;
