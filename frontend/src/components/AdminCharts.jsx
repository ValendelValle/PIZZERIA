const CHART_COLORS = ['#c0392b', '#d97b17', '#2152c6', '#1c8d58', '#7c3aed', '#0f766e'];

function cx(...values) {
  return values.filter(Boolean).join(' ');
}

function donutSegmentPath(cxValue, cyValue, radius, startAngle, endAngle) {
  const start = {
    x: cxValue + radius * Math.cos(startAngle),
    y: cyValue + radius * Math.sin(startAngle),
  };
  const end = {
    x: cxValue + radius * Math.cos(endAngle),
    y: cyValue + radius * Math.sin(endAngle),
  };
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function linePath(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export function BarsChart({ data, formatter }) {
  const max = Math.max(...data.map((item) => Number(item.value || 0)), 1);

  return (
    <div className="bars-chart">
      {data.map((item, index) => {
        const value = Number(item.value || 0);
        const percentage = Math.max((value / max) * 100, 6);
        return (
          <div key={`${item.label}-${index}`} className="bars-chart__row">
            <div className="bars-chart__labels">
              <strong>{item.label}</strong>
              <span>{formatter ? formatter(value) : value}</span>
            </div>
            <div className="bars-chart__track">
              <span
                className="bars-chart__fill"
                style={{
                  width: `${percentage}%`,
                  background: `linear-gradient(135deg, ${CHART_COLORS[index % CHART_COLORS.length]}, rgba(31, 41, 64, 0.92))`,
                }}
              />
            </div>
            {item.helper && <small>{item.helper}</small>}
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({ data, centerLabel, centerValue, formatter }) {
  const total = data.reduce((acc, item) => acc + Number(item.value || 0), 0);
  const size = 220;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  let progress = -Math.PI / 2;

  return (
    <div className="donut-chart">
      <svg viewBox={`0 0 ${size} ${size}`} className="donut-chart__svg" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} className="donut-chart__base" />
        {data.map((item, index) => {
          const value = Number(item.value || 0);
          const segmentSize = total > 0 ? (value / total) * Math.PI * 2 : 0;
          const segment = donutSegmentPath(size / 2, size / 2, radius, progress, progress + segmentSize);
          progress += segmentSize;
          return (
            <path
              key={`${item.label}-${index}`}
              d={segment}
              className="donut-chart__segment"
              style={{ stroke: CHART_COLORS[index % CHART_COLORS.length], strokeDasharray: circumference }}
            />
          );
        })}
      </svg>

      <div className="donut-chart__center">
        <span>{centerLabel}</span>
        <strong>{formatter ? formatter(centerValue) : centerValue}</strong>
      </div>

      <div className="chart-legend">
        {data.map((item, index) => (
          <div key={`${item.label}-legend-${index}`} className="chart-legend__item">
            <span className="chart-legend__swatch" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
            <div>
              <strong>{item.label}</strong>
              <small>{formatter ? formatter(item.value) : item.value}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendChart({ data, formatter }) {
  const width = 420;
  const height = 180;
  const padding = 20;
  const max = Math.max(...data.map((item) => Number(item.value || 0)), 1);
  const min = Math.min(...data.map((item) => Number(item.value || 0)), 0);
  const safeRange = Math.max(max - min, 1);

  const points = data.map((item, index) => ({
    x: padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1),
    y: height - padding - ((Number(item.value || 0) - min) * (height - padding * 2)) / safeRange,
    value: item.value,
    label: item.label,
  }));

  const path = linePath(points);
  const areaPath = `${path} L ${points[points.length - 1]?.x ?? padding} ${height - padding} L ${points[0]?.x ?? padding} ${height - padding} Z`;

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart__svg" aria-hidden="true">
        <path d={areaPath} className="trend-chart__area" />
        <path d={path} className="trend-chart__line" />
        {points.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="4.5" className="trend-chart__dot" />
        ))}
      </svg>

      <div className="trend-chart__labels">
        {data.map((item) => (
          <div key={item.label}>
            <strong>{item.label}</strong>
            <small>{formatter ? formatter(item.value) : item.value}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProgressChart({ data, formatter }) {
  const max = Math.max(...data.map((item) => Number(item.total || item.value || 0)), 1);

  return (
    <div className="progress-chart">
      {data.map((item, index) => {
        const current = Number(item.value || 0);
        const total = Number(item.total || max);
        const ratio = Math.max(Math.min((current / Math.max(total, 1)) * 100, 100), 0);
        return (
          <div key={`${item.label}-${index}`} className="progress-chart__row">
            <div className="progress-chart__head">
              <strong>{item.label}</strong>
              <span>{formatter ? formatter(current) : current}</span>
            </div>
            <div className="progress-chart__track">
              <span
                className={cx('progress-chart__fill', item.variant && `is-${item.variant}`)}
                style={{ width: `${ratio}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
            </div>
            <small>{item.helper || `Base ${formatter ? formatter(total) : total}`}</small>
          </div>
        );
      })}
    </div>
  );
}
