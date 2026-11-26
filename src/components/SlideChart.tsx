import React from 'react';
import { ChartData, ThemeConfig } from '../types/deck';

interface SlideChartProps {
  chart: ChartData;
  theme: ThemeConfig;
}

export const SlideChart: React.FC<SlideChartProps> = ({ chart, theme }) => {
  const points = chart.points?.length ? chart.points : [{ label: 'Q1', value: 10 }];
  const maxVal = Math.max(...points.map((p) => Number(p.value) || 0), 1);
  const totalVal = points.reduce((acc, p) => acc + Math.max(Number(p.value) || 0, 0), 0) || 1;
  const unit = chart.unit ?? '';

  if (chart.type === 'donut') {
    const size = 190;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 66;
    const strokeWidth = 26;
    const circumference = 2 * Math.PI * radius;
    let cumulative = 0;

    return (
      <div
        className="w-full h-full flex flex-col justify-between p-5 rounded-lg border"
        style={{ backgroundColor: theme.surfaceHex, borderColor: theme.borderHex }}
      >
        <div className="text-[13px] font-semibold tracking-tight" style={{ color: theme.inkHex }}>
          {chart.title}
        </div>
        <div className="flex items-center gap-6 my-auto">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={theme.borderHex}
              strokeWidth={strokeWidth}
            />
            {points.map((pt, idx) => {
              const val = Math.max(Number(pt.value) || 0, 0);
              const pct = val / totalVal;
              const dashLength = pct * circumference;
              const dashOffset = -cumulative * circumference;
              cumulative += pct;
              const color = theme.chartPalette[idx % theme.chartPalette.length];
              return (
                <circle
                  key={`${pt.label}-${idx}`}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashLength} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              );
            })}
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              fill={theme.inkHex}
              fontSize="18"
              fontWeight="700"
              className="font-mono-tabular"
            >
              {totalVal.toLocaleString()}
              {unit}
            </text>
            <text
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              fill={theme.mutedHex}
              fontSize="10"
            >
              Total
            </text>
          </svg>
          <div className="flex flex-col gap-2 min-w-0 flex-1">
            {points.map((pt, idx) => {
              const color = theme.chartPalette[idx % theme.chartPalette.length];
              const pct = Math.round(((Math.max(Number(pt.value) || 0, 0)) / totalVal) * 100);
              return (
                <div key={`${pt.label}-${idx}`} className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: color }} />
                    <span className="truncate" style={{ color: theme.inkHex }}>
                      {pt.label}
                    </span>
                  </div>
                  <span className="font-mono-tabular font-medium shrink-0" style={{ color: theme.mutedHex }}>
                    {pt.value}
                    {unit} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (chart.type === 'line') {
    const w = 360;
    const h = 190;
    const padX = 28;
    const padY = 24;
    const plotW = w - padX * 2;
    const plotH = h - padY * 2;

    const coords = points.map((pt, idx) => {
      const x = points.length === 1 ? padX + plotW / 2 : padX + (idx / (points.length - 1)) * plotW;
      const y = padY + plotH - ((Number(pt.value) || 0) / maxVal) * plotH;
      return { x, y, pt };
    });

    const linePath = coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
    const areaPath =
      coords.length > 0
        ? `${linePath} L ${coords[coords.length - 1].x} ${padY + plotH} L ${coords[0].x} ${padY + plotH} Z`
        : '';

    return (
      <div
        className="w-full h-full flex flex-col justify-between p-5 rounded-lg border"
        style={{ backgroundColor: theme.surfaceHex, borderColor: theme.borderHex }}
      >
        <div className="text-[13px] font-semibold tracking-tight" style={{ color: theme.inkHex }}>
          {chart.title}
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full flex-1 mt-2 overflow-visible">
          {[0.25, 0.5, 0.75, 1].map((t) => {
            const y = padY + plotH * (1 - t);
            return (
              <line
                key={t}
                x1={padX}
                y1={y}
                x2={w - padX}
                y2={y}
                stroke={theme.borderHex}
                strokeDasharray="3 3"
              />
            );
          })}
          {areaPath && <path d={areaPath} fill={theme.accentHex} opacity={0.12} />}
          {linePath && (
            <path d={linePath} fill="none" stroke={theme.accentHex} strokeWidth={2.5} strokeLinejoin="round" />
          )}
          {coords.map((c, idx) => (
            <g key={`${c.pt.label}-${idx}`}>
              <circle cx={c.x} cy={c.y} r={4} fill={theme.bgHex} stroke={theme.accentHex} strokeWidth={2.5} />
              <text
                x={c.x}
                y={c.y - 10}
                textAnchor="middle"
                fill={theme.inkHex}
                fontSize="10.5"
                fontWeight="600"
                className="font-mono-tabular"
              >
                {c.pt.value}
                {unit}
              </text>
              <text
                x={c.x}
                y={padY + plotH + 18}
                textAnchor="middle"
                fill={theme.mutedHex}
                fontSize="10.5"
              >
                {c.pt.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  // Default: Bar Chart
  return (
    <div
      className="w-full h-full flex flex-col justify-between p-5 rounded-lg border"
      style={{ backgroundColor: theme.surfaceHex, borderColor: theme.borderHex }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold tracking-tight" style={{ color: theme.inkHex }}>
          {chart.title}
        </span>
        {unit && (
          <span className="text-[11px] font-mono-tabular" style={{ color: theme.mutedHex }}>
            Unit: {unit}
          </span>
        )}
      </div>

      <div className="flex items-end gap-4 h-[195px] pt-6 pb-1 px-2">
        {points.map((pt, idx) => {
          const val = Math.max(Number(pt.value) || 0, 0);
          const heightPct = Math.max(Math.round((val / maxVal) * 100), 4);
          const isLast = idx === points.length - 1;
          return (
            <div key={`${pt.label}-${idx}`} className="flex-1 h-full flex flex-col items-center justify-end gap-2 min-w-0">
              <div className="text-[11px] font-mono-tabular font-semibold" style={{ color: theme.inkHex }}>
                {pt.value}
                {unit}
              </div>
              <div className="w-full flex-1 flex items-end justify-center">
                <div
                  className="w-full max-w-[48px] rounded-t-sm transition-all duration-200"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: isLast ? theme.accentHex : theme.chartPalette[1] ?? theme.accentHex,
                    opacity: isLast ? 1 : 0.72,
                  }}
                />
              </div>
              <div className="text-[11px] truncate w-full text-center" style={{ color: theme.mutedHex }}>
                {pt.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
