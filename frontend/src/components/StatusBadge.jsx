function StatusBadge({ status }) {
  const map = {
    pendiente: { label: 'Pendiente', className: 'is-pending' },
    en_horno: { label: 'En horno', className: 'is-oven' },
    listo: { label: 'Listo', className: 'is-ready' },
  };

  const current = map[status] || { label: status, className: '' };

  return <span className={`status-badge ${current.className}`}>{current.label}</span>;
}

export default StatusBadge;
