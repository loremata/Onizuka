type Props = {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
};

/** Mini grafico a linea inline (SVG), senza librerie. Colore = currentColor. */
export function Sparkline({ values, width = 160, height = 40, className }: Props) {
  if (values.length === 0) {
    return <div style={{ width, height }} className={className} />;
  }
  if (values.length === 1) {
    // Un solo punto: linea piatta al centro.
    values = [values[0], values[0]];
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const last = values[values.length - 1];
  const lastX = (values.length - 1) * stepX;
  const lastY = height - ((last - min) / span) * (height - 4) - 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="andamento"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r={2.5} fill="currentColor" />
    </svg>
  );
}
