function PanelSidebar({ title, subtitle, items, activeKey, onChange }) {
  return (
    <aside className="panel-sidebar">
      <div className="panel-sidebar__head">
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
              {Icon && <Icon size={16} />}
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default PanelSidebar;
