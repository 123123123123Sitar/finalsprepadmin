"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatNumber, formatUsd } from "@/lib/admin/utils";

const chartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function SimpleBarChart({
  items,
  mode = "count",
}: {
  items: Array<{ name: string; value: number }>;
  mode?: "count" | "usd";
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No data available yet.</p>
    );
  }

  const formatValue = (value: number) =>
    mode === "usd" ? formatUsd(value) : formatNumber(value);

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0}
            fontSize={11}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
            tickFormatter={(value: number) => formatValue(value)}
            width={60}
          />
          <ChartTooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            content={
              <ChartTooltipContent
                formatter={(value) => formatValue(Number(value))}
                indicator="dot"
              />
            }
          />
          <Bar
            dataKey="value"
            fill="var(--color-value)"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

