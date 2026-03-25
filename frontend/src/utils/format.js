export function money(value) {
  const number = Number(value || 0);
  const formatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(number);
  return `${formatted} MXN`;
}

export function toMinutesAndSeconds(value) {
  const totalSeconds = Number(value || 0);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}
