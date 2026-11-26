import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { formatSom } from '../data/defaults';
import { AdminAnalyticsPayload, AdminOverviewStats } from '../types/editor';

export interface CoordPoint {
  xLabel: string;
  y: number;
  y2?: number;
}

interface CoordinateLineChartProps {
  numberBadge: string;
  title: string;
  subtitle: string;
  xAxisLabel: string;
  yAxisLabel: string;
  points: CoordPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  valueFormatter?: (v: number) => string;
  variant?: 'line' | 'bar';
}

function compactFormat(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
}

export const CoordinatePlotCard: React.FC<CoordinateLineChartProps> = ({
  numberBadge,
  title,
  subtitle,
  xAxisLabel,
  yAxisLabel,
  points,
  primaryLabel,
  secondaryLabel,
  primaryColor = '#dc2626',
  secondaryColor = '#059669',
  valueFormatter = (v) => String(Math.round(v)),
  variant = 'line',
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const safePoints = points.length > 0 ? points : [{ xLabel: '—', y: 0 }];
  const allVals = safePoints.flatMap((p) => (typeof p.y2 === 'number' ? [p.y, p.y2] : [p.y]));
  const rawMin = Math.min(0, ...allVals);
  const rawMax = Math.max(1, ...allVals);
  const span = Math.max(1, rawMax - rawMin);

  const W = 420;
  const H = 186;
  const padL = 46;
  const padR = 14;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const toX = (idx: number) => {
    if (safePoints.length <= 1) return padL + plotW / 2;
    return padL + (idx / (safePoints.length - 1)) * plotW;
  };
  const toY = (val: number) => padT + ((rawMax - val) / span) * plotH;
  const zeroY = toY(0);

  const path1 = safePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.y).toFixed(1)}`)
    .join(' ');

  const area1 =
    safePoints.length > 1
      ? `${path1} L ${toX(safePoints.length - 1).toFixed(1)} ${zeroY.toFixed(1)} L ${toX(0).toFixed(1)} ${zeroY.toFixed(1)} Z`
      : '';

  const hasSecond = safePoints.some((p) => typeof p.y2 === 'number');
  const path2 = hasSecond
    ? safePoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.y2 || 0).toFixed(1)}`)
        .join(' ')
    : '';

  const yTicks = [rawMax, rawMin + span * 0.5, rawMin];
  const activePoint =
    hoverIdx !== null && safePoints[hoverIdx]
      ? safePoints[hoverIdx]
      : safePoints[safePoints.length - 1];

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col justify-between gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-bold text-red-600">{numberBadge}</span>
            <h3 className="text-xs font-semibold text-zinc-900 truncate">{title}</h3>
          </div>
          <p className="text-[11px] text-zinc-500 truncate mt-0.5">{subtitle}</p>
        </div>
        <div className="text-right shrink-0 font-mono tabular-nums">
          <div className="text-[11px] font-bold text-zinc-900">
            ({activePoint.xLabel}, {valueFormatter(activePoint.y)})
          </div>
          {hasSecond && typeof activePoint.y2 === 'number' && (
            <div className="text-[10px]" style={{ color: secondaryColor }}>
              {secondaryLabel}: {valueFormatter(activePoint.y2)}
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-40 select-none overflow-visible"
          role="img"
          aria-label={title}
        >
          {/* Y-axis horizontal gridlines & labels */}
          {yTicks.map((tv, idx) => {
            const yy = toY(tv);
            return (
              <g key={idx}>
                <line
                  x1={padL}
                  y1={yy}
                  x2={W - padR}
                  y2={yy}
                  stroke={tv === 0 ? '#a1a1aa' : '#e4e4e7'}
                  strokeDasharray={tv === 0 ? undefined : '3 3'}
                  strokeWidth={1}
                />
                <text
                  x={padL - 6}
                  y={yy + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill="#71717a"
                  fontFamily="monospace"
                >
                  {compactFormat(tv)}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#71717a" strokeWidth={1} />
          <line
            x1={padL}
            y1={padT + plotH}
            x2={W - padR}
            y2={padT + plotH}
            stroke="#71717a"
            strokeWidth={1}
          />

          {/* Bars or Line */}
          {variant === 'bar' ? (
            safePoints.map((p, i) => {
              const barSlot = plotW / Math.max(1, safePoints.length);
              const bw = Math.max(8, Math.min(28, barSlot * 0.62));
              const bx = padL + i * barSlot + (barSlot - bw) / 2;
              const topY = Math.min(zeroY, toY(p.y));
              const bh = Math.max(2, Math.abs(zeroY - toY(p.y)));
              const isHover = hoverIdx === i;
              return (
                <g
                  key={i}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={bx}
                    y={topY}
                    width={bw}
                    height={bh}
                    rx={3}
                    fill={primaryColor}
                    opacity={isHover ? 1 : 0.85}
                  />
                  {hasSecond && typeof p.y2 === 'number' && (
                    <circle
                      cx={bx + bw / 2}
                      cy={toY(p.y2)}
                      r={3.5}
                      fill={secondaryColor}
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                  )}
                </g>
              );
            })
          ) : (
            <>
              {area1 && <path d={area1} fill={primaryColor} opacity={0.08} />}
              {path1 && (
                <path
                  d={path1}
                  fill="none"
                  stroke={primaryColor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {path2 && (
                <path
                  d={path2}
                  fill="none"
                  stroke={secondaryColor}
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Hover crosshair */}
              {hoverIdx !== null && safePoints[hoverIdx] && (
                <line
                  x1={toX(hoverIdx)}
                  y1={padT}
                  x2={toX(hoverIdx)}
                  y2={padT + plotH}
                  stroke="#a1a1aa"
                  strokeDasharray="2 2"
                  strokeWidth={1}
                />
              )}

              {/* Data points + hit targets */}
              {safePoints.map((p, i) => {
                const cx = toX(i);
                const cy = toY(p.y);
                const isHover = hoverIdx === i;
                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={cx - Math.max(8, plotW / safePoints.length / 2)}
                      y={padT}
                      width={Math.max(16, plotW / safePoints.length)}
                      height={plotH}
                      fill="transparent"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHover ? 4.5 : 2.8}
                      fill={primaryColor}
                      stroke="#ffffff"
                      strokeWidth={1.2}
                    />
                    {hasSecond && typeof p.y2 === 'number' && (
                      <circle
                        cx={cx}
                        cy={toY(p.y2)}
                        r={isHover ? 4.2 : 2.5}
                        fill={secondaryColor}
                        stroke="#ffffff"
                        strokeWidth={1}
                      />
                    )}
                  </g>
                );
              })}
            </>
          )}

          {/* X-axis edge labels */}
          {safePoints.map((p, i) => {
            const step = Math.max(1, Math.ceil(safePoints.length / 5));
            if (i !== 0 && i !== safePoints.length - 1 && i % step !== 0) return null;
            const x =
              variant === 'bar'
                ? padL + (i + 0.5) * (plotW / Math.max(1, safePoints.length))
                : toX(i);
            return (
              <text
                key={`xl-${i}`}
                x={x}
                y={H - 8}
                textAnchor="middle"
                fontSize={9}
                fill="#71717a"
                fontFamily="monospace"
              >
                {p.xLabel.slice(0, 8)}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-100 pt-2">
        <span className="font-mono">
          X: {xAxisLabel} · Y: {yAxisLabel}
        </span>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: primaryColor }}
            />
            <span>{primaryLabel}</span>
          </span>
          {hasSecond && secondaryLabel && (
            <span className="inline-flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: secondaryColor }}
              />
              <span>{secondaryLabel}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

interface AdminCoordinateStatsProps {
  analytics: AdminAnalyticsPayload | null;
  overview: AdminOverviewStats;
  days: 7 | 14 | 30;
  onChangeDays: (days: 7 | 14 | 30) => void;
}

export const AdminCoordinateStats: React.FC<AdminCoordinateStatsProps> = ({
  analytics,
  overview,
  days,
  onChangeDays,
}) => {
  const daily = analytics?.daily || [];
  const shortDay = (d: string) => (d.length >= 10 ? d.slice(5) : d);

  // 1..9 Daily & Hourly Coordinate Series
  const p1RevenueVsSpent: CoordPoint[] = daily.map((d) => ({
    xLabel: shortDay(d.day),
    y: d.paidRevenue,
    y2: d.aiSpent,
  }));

  const p2NewUsers: CoordPoint[] = daily.map((d) => ({
    xLabel: shortDay(d.day),
    y: d.newUsers,
  }));

  const p3Hourly: CoordPoint[] = (analytics?.hourlyActivity || []).map((h) => ({
    xLabel: h.label,
    y: h.count,
    y2: h.revenue,
  }));

  const p4Orders: CoordPoint[] = daily.map((d) => ({
    xLabel: shortDay(d.day),
    y: d.paidOrders,
  }));

  const p5Aov: CoordPoint[] = daily.map((d) => ({
    xLabel: shortDay(d.day),
    y: d.avgOrderValue ?? (d.paidOrders > 0 ? Math.round(d.paidRevenue / d.paidOrders) : 0),
  }));

  const p6NetCashflow: CoordPoint[] = daily.map((d) => ({
    xLabel: shortDay(d.day),
    y: d.netCashflow ?? d.paidRevenue - d.aiSpent,
  }));

  const p7ActiveUsers: CoordPoint[] = daily.map((d) => ({
    xLabel: shortDay(d.day),
    y: d.activeUsers ?? d.newUsers,
  }));

  const p8ProjectsCreated: CoordPoint[] = daily.map((d) => ({
    xLabel: shortDay(d.day),
    y: d.projectsCreated ?? 0,
  }));

  const p9PromoUses: CoordPoint[] = daily.map((d) => ({
    xLabel: shortDay(d.day),
    y: d.promoUses ?? 0,
  }));

  // 10..18 Category, Segment, Support, Security Coordinate Bars
  const p10Services: CoordPoint[] = (analytics?.serviceBreakdown || []).map((s) => ({
    xLabel: s.label.slice(0, 8),
    y: s.totalAmount,
    y2: s.count,
  }));

  const p11Methods: CoordPoint[] = (analytics?.paymentMethodBreakdown || []).map((m) => ({
    xLabel: m.method.slice(0, 8),
    y: m.amount,
    y2: m.count,
  }));

  const p12Segments: CoordPoint[] = (analytics?.userSegmentBreakdown || []).map((seg) => ({
    xLabel: seg.segment.slice(0, 8),
    y: seg.count,
  }));

  const p13TopUsers: CoordPoint[] = (analytics?.topSpenders || []).slice(0, 8).map((u, idx) => ({
    xLabel: `#${idx + 1} ${u.firstName.slice(0, 5)}`,
    y: u.totalDeposited || u.balance,
  }));

  const p14Staff: CoordPoint[] = (analytics?.staffActivityBreakdown || []).map((st) => ({
    xLabel: st.name.slice(0, 8),
    y: st.actions,
  }));

  const sup = analytics?.supportMetrics || {
    openCount: 0,
    pendingCount: 0,
    resolvedCount: 0,
    totalMessages: 0,
    telegramChannelCount: 0,
    siteChannelCount: 0,
  };
  const p15SupportStatus: CoordPoint[] = [
    { xLabel: 'Ochiq', y: sup.openCount },
    { xLabel: 'Kutilm.', y: sup.pendingCount },
    { xLabel: 'Hal', y: sup.resolvedCount },
  ];

  const p16SupportChannels: CoordPoint[] = [
    { xLabel: 'Sayt', y: sup.siteChannelCount },
    { xLabel: 'Telegram', y: sup.telegramChannelCount },
    { xLabel: 'Jami', y: sup.totalMessages },
  ];

  const sec = analytics?.securityMetrics || {
    totalLogs: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    unresolvedCount: 0,
    dailyThreats: [],
  };
  const p17DailyThreats: CoordPoint[] = (sec.dailyThreats || []).map((d) => ({
    xLabel: shortDay(d.day),
    y: d.count,
    y2: d.critical,
  }));

  const p18Severity: CoordPoint[] = [
    { xLabel: 'Critical', y: sec.criticalCount },
    { xLabel: 'High', y: sec.highCount },
    { xLabel: 'Medium', y: sec.mediumCount },
    { xLabel: 'Low', y: sec.lowCount },
  ];

  const ref = analytics?.referralMetrics || {
    totalReferrals: overview.totalReferrals,
    totalInviterBonus: 0,
    conversionRate: 0,
  };
  const p19Referrals: CoordPoint[] = [
    { xLabel: 'Userlar', y: overview.totalUsers },
    { xLabel: 'Referal', y: ref.totalReferrals },
    { xLabel: 'Konv %', y: ref.conversionRate },
  ];

  const eco = analytics?.economyMetrics || {
    totalDeposited: overview.totalPaidRevenue,
    totalSpent: 0,
    promoBonusGiven: 0,
    netMargin: overview.totalPaidRevenue,
    retentionRate: 0,
    repeatOrderRate: 0,
    averageOrderValue: 0,
  };
  const p20Economy: CoordPoint[] = [
    { xLabel: 'Depozit', y: eco.totalDeposited },
    { xLabel: 'AI Sarf', y: eco.totalSpent },
    { xLabel: 'Promo', y: eco.promoBonusGiven },
    { xLabel: 'Marja', y: eco.netMargin },
  ];

  return (
    <section className="space-y-4">
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-red-600" />
            <span>20 Xil Kordinatali Statistika (X / Y O‘qlar Tizimi)</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Har bir grafik ustiga kursorni olib boring — aniq (X, Y) koordinata nuqtasi ko‘rinadi.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl self-start">
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChangeDays(d)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap ${
                days === d
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {d} kun
            </button>
          ))}
        </div>
      </div>

      {/* Economy Summary Strip for Retention & Repeat Rate */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
          <div className="text-[11px] text-zinc-500">Retention (Faol ulush)</div>
          <div className="text-base font-bold font-mono tabular-nums text-zinc-900 mt-0.5">
            {eco.retentionRate}%
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
          <div className="text-[11px] text-zinc-500">Qayta to‘lov (Repeat Rate)</div>
          <div className="text-base font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
            {eco.repeatOrderRate}%
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
          <div className="text-[11px] text-zinc-500">O‘rtacha Chek (AOV)</div>
          <div className="text-base font-bold font-mono tabular-nums text-zinc-900 mt-0.5">
            {formatSom(eco.averageOrderValue)}
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
          <div className="text-[11px] text-zinc-500">Referal konversiya / bonus</div>
          <div className="text-base font-bold font-mono tabular-nums text-red-600 mt-0.5">
            {ref.conversionRate}% · {formatSom(ref.totalInviterBonus)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <CoordinatePlotCard
          numberBadge="#01"
          title="Kunlik Tushum vs AI Sarfi"
          subtitle="TolovGo kirimi va AI xizmatlar sarfi"
          xAxisLabel="Sana"
          yAxisLabel="so'm"
          points={p1RevenueVsSpent}
          primaryLabel="Tushum"
          secondaryLabel="AI sarfi"
          primaryColor="#059669"
          secondaryColor="#dc2626"
          valueFormatter={formatSom}
        />
        <CoordinatePlotCard
          numberBadge="#02"
          title="Yangi Foydalanuvchilar Dinamikasi"
          subtitle="Bot va ilovaga qo'shilgan kunlik userlar"
          xAxisLabel="Sana"
          yAxisLabel="kishi"
          points={p2NewUsers}
          primaryLabel="Yangi user"
          primaryColor="#dc2626"
        />
        <CoordinatePlotCard
          numberBadge="#03"
          title="Soatlik Faollik (00:00–23:00)"
          subtitle="Sutkaning qaysi soatida buyurtma ko'p"
          xAxisLabel="Soat"
          yAxisLabel="amallar"
          points={p3Hourly}
          primaryLabel="Buyurtma"
          secondaryLabel="Summa"
          primaryColor="#111113"
          secondaryColor="#059669"
        />
        <CoordinatePlotCard
          numberBadge="#04"
          title="To‘langan Buyurtmalar Soni"
          subtitle="Kunlik muvaffaqiyatli TolovGo cheklari"
          xAxisLabel="Sana"
          yAxisLabel="dona"
          points={p4Orders}
          primaryLabel="Buyurtma"
          primaryColor="#0284c7"
        />
        <CoordinatePlotCard
          numberBadge="#05"
          title="O‘rtacha Chek (AOV) Koordinatasi"
          subtitle="Har bir to'lovning kunlik o'rtacha qiymati"
          xAxisLabel="Sana"
          yAxisLabel="so'm"
          points={p5Aov}
          primaryLabel="AOV"
          primaryColor="#7c3aed"
          valueFormatter={formatSom}
        />
        <CoordinatePlotCard
          numberBadge="#06"
          title="Sof Pul Oqimi (Net Cashflow)"
          subtitle="Kunlik kirim minus AI xizmat xarajatlari"
          xAxisLabel="Sana"
          yAxisLabel="so'm"
          points={p6NetCashflow}
          primaryLabel="Sof oqim"
          primaryColor="#059669"
          valueFormatter={formatSom}
        />
        <CoordinatePlotCard
          numberBadge="#07"
          title="Faol Foydalanuvchilar (DAU)"
          subtitle="Kunlik faol sessiya/amaliyot qilganlar"
          xAxisLabel="Sana"
          yAxisLabel="kishi"
          points={p7ActiveUsers}
          primaryLabel="Faol user"
          primaryColor="#0f766e"
        />
        <CoordinatePlotCard
          numberBadge="#08"
          title="Bulutli Loyihalar Yaratilishi"
          subtitle="Neon bazasiga saqlangan taqdimot/hujjatlar"
          xAxisLabel="Sana"
          yAxisLabel="loyiha"
          points={p8ProjectsCreated}
          primaryLabel="Loyiha"
          primaryColor="#1d4ed8"
        />
        <CoordinatePlotCard
          numberBadge="#09"
          title="Promokod Faollashuvi"
          subtitle="Kunlik vaucher va promokod ishlatilishi"
          xAxisLabel="Sana"
          yAxisLabel="marta"
          points={p9PromoUses}
          primaryLabel="Promokod"
          primaryColor="#d97706"
        />
        <CoordinatePlotCard
          numberBadge="#10"
          title="AI Xizmatlar Bo‘yicha Tushum"
          subtitle="Slayd, Daftar va Infografika xizmatlari"
          xAxisLabel="Xizmat"
          yAxisLabel="so'm"
          points={p10Services}
          primaryLabel="Sarf summasi"
          secondaryLabel="Soni"
          primaryColor="#dc2626"
          secondaryColor="#111113"
          variant="bar"
          valueFormatter={formatSom}
        />
        <CoordinatePlotCard
          numberBadge="#11"
          title="TolovGo To‘lov Usullari"
          subtitle="Click, Payme, Uzum va sinov to'lovlari"
          xAxisLabel="Usul"
          yAxisLabel="so'm"
          points={p11Methods}
          primaryLabel="Summa"
          secondaryLabel="Soni"
          primaryColor="#059669"
          variant="bar"
          valueFormatter={formatSom}
        />
        <CoordinatePlotCard
          numberBadge="#12"
          title="Mijoz Segmentlari Taqsimoti"
          subtitle="VIP, Faol, Yangi, 0-Balans va Bloklangan"
          xAxisLabel="Segment"
          yAxisLabel="kishi"
          points={p12Segments}
          primaryLabel="Soni"
          primaryColor="#111113"
          variant="bar"
        />
        <CoordinatePlotCard
          numberBadge="#13"
          title="Top Mijozlar Koordinatasi"
          subtitle="Eng ko'p balans kiritgan yetakchi mijozlar"
          xAxisLabel="Mijoz"
          yAxisLabel="so'm"
          points={p13TopUsers}
          primaryLabel="Depozit"
          primaryColor="#0284c7"
          variant="bar"
          valueFormatter={formatSom}
        />
        <CoordinatePlotCard
          numberBadge="#14"
          title="Xodimlar CRM Faolligi"
          subtitle="Admin, Menejer va Support audit harakatlari"
          xAxisLabel="Xodim"
          yAxisLabel="amal"
          points={p14Staff}
          primaryLabel="Amallar"
          primaryColor="#7c3aed"
          variant="bar"
        />
        <CoordinatePlotCard
          numberBadge="#15"
          title="Support Tiketlar Holati"
          subtitle="Ochiq, kutilayotgan va hal qilinganlar"
          xAxisLabel="Holat"
          yAxisLabel="tiket"
          points={p15SupportStatus}
          primaryLabel="Tiketlar"
          primaryColor="#dc2626"
          variant="bar"
        />
        <CoordinatePlotCard
          numberBadge="#16"
          title="Support Kanallari (Sayt vs TG)"
          subtitle="Sayt ichidan va Telegram lichkadan kelganlar"
          xAxisLabel="Kanal"
          yAxisLabel="xabar"
          points={p16SupportChannels}
          primaryLabel="Xabarlar"
          primaryColor="#0284c7"
          variant="bar"
        />
        <CoordinatePlotCard
          numberBadge="#17"
          title="Kunlik Xavfsizlik Hodisalari"
          subtitle="Barcha shubhali urinishlar va kritik xavflar"
          xAxisLabel="Sana"
          yAxisLabel="hodisa"
          points={p17DailyThreats}
          primaryLabel="Jami log"
          secondaryLabel="Yuqori/Kritik"
          primaryColor="#d97706"
          secondaryColor="#dc2626"
        />
        <CoordinatePlotCard
          numberBadge="#18"
          title="Xavf Darajalari Koordinatasi"
          subtitle="Critical, High, Medium va Low taqsimoti"
          xAxisLabel="Daraja"
          yAxisLabel="soni"
          points={p18Severity}
          primaryLabel="Hodisalar"
          primaryColor="#dc2626"
          variant="bar"
        />
        <CoordinatePlotCard
          numberBadge="#19"
          title="Referal Konversiya Grafigi"
          subtitle="Umumiy user, referal va foiz ko'rsatkichi"
          xAxisLabel="Ko'rsatkich"
          yAxisLabel="qiymat"
          points={p19Referrals}
          primaryLabel="Referal"
          primaryColor="#059669"
          variant="bar"
        />
        <CoordinatePlotCard
          numberBadge="#20"
          title="Iqtisodiy Samaradorlik Balansi"
          subtitle="Depozit, AI sarf, promokod bonusi va sof marja"
          xAxisLabel="Kategoriya"
          yAxisLabel="so'm"
          points={p20Economy}
          primaryLabel="Qiymat"
          primaryColor="#111113"
          variant="bar"
          valueFormatter={formatSom}
        />
      </div>
    </section>
  );
};
