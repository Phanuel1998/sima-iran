import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { BarChart3, TrendingUp, DollarSign, Award } from 'lucide-react';
import type { Visit, DailySalesPoint } from '../types.ts';
import { calculateDailySalesLast7Days } from '../utils/metrics.ts';

interface SalesBarChartProps {
  visits: Visit[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DailySalesPoint }>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  return (
    <div
      className="p-3 rounded-xl bg-slate-950/95 border border-slate-700 text-xs text-white shadow-2xl space-y-1.5 backdrop-blur-md"
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5">
        <span className="font-bold text-slate-200">
          {data.dayLabel} ({data.shortDate})
        </span>
        <span className="text-[10px] text-slate-400 font-mono">{data.date}</span>
      </div>

      <div className="flex items-center justify-between gap-4 pt-0.5">
        <span className="text-slate-400">مبلغ فروش:</span>
        <span className="font-bold text-emerald-400 text-sm">
          {data.salesAmount.toLocaleString('fa-IR')} <span className="text-[10px] font-normal">تومان</span>
        </span>
      </div>

      {data.unitsSold > 0 && (
        <div className="flex items-center justify-between gap-4 text-[11px]">
          <span className="text-slate-400">تعداد اقلام:</span>
          <span className="font-semibold text-emerald-300">
            {data.unitsSold.toLocaleString('fa-IR')} قلم
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
        <span>فروش‌های موفق:</span>
        <span className="text-slate-200 font-semibold">{data.soldCount.toLocaleString('fa-IR')}</span>
      </div>

      {data.sampleCount > 0 && (
        <div className="flex items-center justify-between gap-4 text-[11px] text-blue-400">
          <span>ارائه نمونه:</span>
          <span className="font-semibold">{data.sampleCount.toLocaleString('fa-IR')} مورد</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 text-[10px] text-slate-500">
        <span>کل ویزیت‌های روز:</span>
        <span>{data.totalVisits.toLocaleString('fa-IR')}</span>
      </div>
    </div>
  );
};

export const SalesBarChart: React.FC<SalesBarChartProps> = ({ visits }) => {
  const data = useMemo(() => calculateDailySalesLast7Days(visits), [visits]);

  // Aggregate 7-day stats
  const { totalSales, avgSales, bestDay, maxSale } = useMemo(() => {
    let total = 0;
    let max = 0;
    let best = data[0];

    for (const d of data) {
      total += d.salesAmount;
      if (d.salesAmount > max) {
        max = d.salesAmount;
        best = d;
      }
    }

    return {
      totalSales: total,
      avgSales: Math.round(total / 7),
      bestDay: max > 0 ? best : null,
      maxSale: max,
    };
  }, [data]);

  const formatYAxis = (val: number) => {
    if (val === 0) return '۰';
    if (val >= 1_000_000) {
      const millions = Math.round((val / 1_000_000) * 10) / 10;
      return `${millions.toLocaleString('fa-IR')} م`;
    }
    if (val >= 1_000) {
      const thousands = Math.round(val / 1_000);
      return `${thousands.toLocaleString('fa-IR')} هـ`;
    }
    return val.toLocaleString('fa-IR');
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-lg space-y-3 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>روند عملکرد فروش</span>
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-700/80 text-emerald-300">
                ۷ روز اخیر
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">مبالغ فروش روزانه بر حسب تومان</p>
          </div>
        </div>

        {bestDay && (
          <div className="hidden sm:flex items-center gap-1 text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg">
            <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>بهترین روز: {bestDay.dayLabel}</span>
          </div>
        )}
      </div>

      {/* 3 Metric Pills */}
      <div className="grid grid-cols-3 gap-2 text-center pt-1">
        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-700/60">
          <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-400" />
            <span>مجموع ۷ روز</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-emerald-400 mt-0.5 line-clamp-1">
            {totalSales.toLocaleString('fa-IR')}
          </div>
        </div>

        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-700/60">
          <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3 text-sky-400" />
            <span>میانگین روزانه</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-sky-300 mt-0.5 line-clamp-1">
            {avgSales.toLocaleString('fa-IR')}
          </div>
        </div>

        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-700/60">
          <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
            <Award className="w-3 h-3 text-amber-400" />
            <span>روز برتر</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-amber-300 mt-0.5 line-clamp-1">
            {bestDay ? bestDay.dayLabel : 'بدون فروش'}
          </div>
        </div>
      </div>

      {/* Recharts Bar Chart */}
      <div className="w-full pt-1" style={{ height: 210 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 15, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
            <XAxis
              dataKey="dayLabel"
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#475569' }}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
              domain={[0, (dataMax: number) => (dataMax > 0 ? Math.ceil(dataMax * 1.15) : 100000)]}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(51, 65, 85, 0.4)', radius: 8 }}
            />
            <Bar
              dataKey="salesAmount"
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
            >
              {data.map((entry, index) => {
                const isToday = index === data.length - 1;
                const isBest = maxSale > 0 && entry.salesAmount === maxSale;
                let fill = '#334155'; // empty day

                if (entry.salesAmount > 0) {
                  if (isToday) fill = '#10b981'; // today active: bright emerald
                  else if (isBest) fill = '#059669'; // best day: emerald green
                  else fill = '#0d9488'; // regular active day: teal/cyan
                } else if (isToday) {
                  fill = '#1e293b'; // today with 0 sales
                }

                return (
                  <Cell
                    key={`cell-${entry.date}`}
                    fill={fill}
                    stroke={isToday ? '#34d399' : undefined}
                    strokeWidth={isToday ? 1.5 : 0}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer / Legend */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
            <span>امروز</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-teal-600 inline-block" />
            <span>روزهای گذشته</span>
          </div>
        </div>
        <span className="text-[10px] text-slate-500 font-sans">بروزرسانی زنده با هر ویزیت</span>
      </div>
    </div>
  );
};
