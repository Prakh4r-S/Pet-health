"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type WeightPoint = { date: string; weightKg: number };

export default function WeightChart({
  data,
  healthyMin,
  healthyMax,
}: {
  data: WeightPoint[];
  healthyMin?: number | null;
  healthyMax?: number | null;
}) {
  if (data.length < 2) {
    return (
      <p className="rounded-md border border-dashed border-mist-deep p-6 text-center text-sm text-ink-soft">
        Log at least two weights to see a trend.
      </p>
    );
  }

  const weights = data.map((d) => d.weightKg);
  const band = healthyMin != null && healthyMax != null;

  // Include the healthy band in the domain, otherwise the shaded area is
  // clipped when the pet sits well outside it — which is exactly when
  // seeing the band matters most.
  const lo = Math.min(...weights, band ? healthyMin : Infinity);
  const hi = Math.max(...weights, band ? healthyMax : -Infinity);
  const pad = Math.max((hi - lo) * 0.15, 0.5);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ecf0f3" />
          {band && (
            <ReferenceArea
              y1={healthyMin!}
              y2={healthyMax!}
              fill="#4c9c9c"
              fillOpacity={0.08}
            />
          )}
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#858b99" />
          <YAxis
            domain={[Number((lo - pad).toFixed(1)), Number((hi + pad).toFixed(1))]}
            tick={{ fontSize: 12 }}
            stroke="#858b99"
            unit="kg"
            width={60}
          />
          <Tooltip formatter={(v) => [`${v} kg`, "Weight"] as [string, string]} />
          <Line
            type="monotone"
            dataKey="weightKg"
            stroke="#0c1c44"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
