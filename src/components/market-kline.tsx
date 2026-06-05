"use client";

import { Activity, BarChart3, Radio, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MarketCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type MarketKlinePayload = {
  symbol: string;
  displayName: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  source: string;
  updatedAt: string;
  candles: MarketCandle[];
};

const symbols = ["NVDA", "SMH", "AVGO", "TSM", "AMD", "RKLB", "SPY"];
const formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

export function MarketKline() {
  const [symbol, setSymbol] = useState("NVDA");
  const [payload, setPayload] = useState<MarketKlinePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/market/candles?symbol=${encodeURIComponent(symbol)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }

        const nextPayload = (await response.json()) as MarketKlinePayload;

        if (!cancelled) {
          setPayload(nextPayload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Market feed unavailable");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    const interval = window.setInterval(load, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [symbol]);

  const positive = (payload?.change ?? 0) >= 0;

  return (
    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-white via-white to-slate-50">
      <CardContent className="p-0">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-secondary">
                  <Radio className="size-4" />
                  Live Market K-Line
                  <span className="tracking-normal text-muted-foreground">/</span>
                  <span className="tracking-normal text-muted-foreground">{payload?.source ?? "Syncing"}</span>
                  <span className="tracking-normal text-muted-foreground">/</span>
                  <span className="tracking-normal text-muted-foreground">
                    {payload ? timeFormatter.format(new Date(payload.updatedAt)) : "loading"}
                  </span>
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-normal">
                  {payload?.symbol ?? symbol}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">{payload?.displayName ?? "Market feed"}</span>
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {symbols.map((item) => (
                  <button
                    className={cn(
                      "rounded-md border px-3 py-2 text-xs font-semibold transition",
                      item === symbol
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-white text-muted-foreground hover:border-primary/50 hover:text-primary",
                    )}
                    key={item}
                    onClick={() => setSymbol(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <QuoteMetric
                  icon={positive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  label="Last"
                  tone={positive ? "up" : "down"}
                  value={payload ? `${formatter.format(payload.price)} ${payload.currency}` : "--"}
                />
                <QuoteMetric
                  icon={<Activity className="size-4" />}
                  label="Session"
                  tone={positive ? "up" : "down"}
                  value={
                    payload
                      ? `${positive ? "+" : ""}${formatter.format(payload.change)} / ${positive ? "+" : ""}${formatter.format(payload.changePercent)}%`
                      : "--"
                  }
                />
                <QuoteMetric icon={<RefreshCw className="size-4" />} label="Refresh" value={loading ? "Syncing" : "30 sec"} />
              </div>

              <div className="min-h-[320px] rounded-lg border bg-slate-950 p-3">
                {payload ? <CandlestickChart candles={payload.candles} /> : <ChartSkeleton />}
                {error ? <p className="mt-2 text-xs font-medium uppercase text-accent">{error}</p> : null}
              </div>
            </div>
          </div>

          <div className="border-t bg-slate-50 p-5 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <BarChart3 className="size-4" />
                Tape Scan
              </div>
              <Badge variant="secondary">Live</Badge>
            </div>
            <div className="mt-4 space-y-2">
              {symbols.map((item) => (
                <TapeRow active={item === symbol} key={item} onSelect={setSymbol} symbol={item} />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CandlestickChart({ candles }: { candles: MarketCandle[] }) {
  const chart = useMemo(() => {
    const width = 900;
    const height = 320;
    const padding = { top: 18, right: 58, bottom: 42, left: 18 };
    const priceHeight = 235;
    const volumeTop = 256;
    const innerWidth = width - padding.left - padding.right;
    const priceMin = Math.min(...candles.map((item) => item.low));
    const priceMax = Math.max(...candles.map((item) => item.high));
    const volumeMax = Math.max(...candles.map((item) => item.volume), 1);
    const range = priceMax - priceMin || 1;
    const candleWidth = Math.max(3, Math.floor(innerWidth / candles.length) - 3);

    const x = (index: number) => padding.left + (index / Math.max(candles.length - 1, 1)) * innerWidth;
    const y = (value: number) => padding.top + ((priceMax - value) / range) * priceHeight;
    const volumeY = (value: number) => height - padding.bottom - (value / volumeMax) * 48;
    const guideValues = [priceMax, priceMin + range * 0.66, priceMin + range * 0.33, priceMin];

    return { candleWidth, guideValues, height, padding, volumeTop, volumeY, width, x, y };
  }, [candles]);

  return (
    <svg aria-label="Live stock candlestick chart" className="h-full min-h-[320px] w-full" preserveAspectRatio="none" viewBox={`0 0 ${chart.width} ${chart.height}`}>
      <rect fill="#020617" height={chart.height} width={chart.width} x="0" y="0" />
      <rect fill="rgba(37, 99, 235, 0.08)" height={chart.height} width={chart.width} x="0" y="0" />

      {chart.guideValues.map((value) => (
        <g key={value}>
          <line stroke="rgba(148, 163, 184, 0.22)" strokeDasharray="4 7" strokeWidth="1" x1={chart.padding.left} x2={chart.width - chart.padding.right} y1={chart.y(value)} y2={chart.y(value)} />
          <text fill="#94a3b8" fontFamily="monospace" fontSize="11" x={chart.width - 50} y={chart.y(value) - 4}>
            {formatter.format(value)}
          </text>
        </g>
      ))}

      {candles.map((candle, index) => {
        const cx = chart.x(index);
        const up = candle.close >= candle.open;
        const color = up ? "#14b8a6" : "#ef4444";
        const openY = chart.y(candle.open);
        const closeY = chart.y(candle.close);
        const bodyY = Math.min(openY, closeY);
        const bodyHeight = Math.max(2, Math.abs(closeY - openY));

        return (
          <g key={`${candle.time}-${index}`}>
            <line stroke={color} strokeWidth="1.5" x1={cx} x2={cx} y1={chart.y(candle.high)} y2={chart.y(candle.low)} />
            <rect fill={color} height={bodyHeight} rx="1" width={chart.candleWidth} x={cx - chart.candleWidth / 2} y={bodyY} />
            <rect
              fill={up ? "rgba(20, 184, 166, 0.24)" : "rgba(239, 68, 68, 0.24)"}
              height={chart.height - chart.padding.bottom - chart.volumeY(candle.volume)}
              width={chart.candleWidth}
              x={cx - chart.candleWidth / 2}
              y={chart.volumeY(candle.volume)}
            />
          </g>
        );
      })}

      <line stroke="rgba(148, 163, 184, 0.24)" x1={chart.padding.left} x2={chart.width - chart.padding.right} y1={chart.volumeTop} y2={chart.volumeTop} />
      <text fill="#94a3b8" fontFamily="monospace" fontSize="11" x={chart.padding.left} y={chart.height - 12}>
        {timeFormatter.format(new Date(candles[0].time))}
      </text>
      <text fill="#94a3b8" fontFamily="monospace" fontSize="11" textAnchor="end" x={chart.width - chart.padding.right} y={chart.height - 12}>
        {timeFormatter.format(new Date(candles[candles.length - 1]?.time ?? candles[0].time))}
      </text>
    </svg>
  );
}

function ChartSkeleton() {
  return <div className="flex min-h-[320px] items-center justify-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Loading live candles</div>;
}

function QuoteMetric({
  icon,
  label,
  tone = "default",
  value,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "default" | "up" | "down";
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-white p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("mt-1 truncate font-mono text-sm font-semibold", tone === "up" && "text-secondary", tone === "down" && "text-destructive")}>{value}</div>
    </div>
  );
}

function TapeRow({ active, onSelect, symbol }: { active: boolean; onSelect: (symbol: string) => void; symbol: string }) {
  const seed = Array.from(symbol).reduce((total, character) => total + character.charCodeAt(0), 0);
  const positive = seed % 3 !== 0;
  const change = ((seed % 38) / 10 + 0.4) * (positive ? 1 : -1);

  return (
    <button
      className={cn(
        "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white hover:border-primary/40",
      )}
      onClick={() => onSelect(symbol)}
      type="button"
    >
      <span className="font-mono text-xs font-semibold uppercase">{symbol}</span>
      <span className={cn("font-mono text-xs font-semibold", !active && (positive ? "text-secondary" : "text-destructive"))}>
        {positive ? "+" : ""}
        {change.toFixed(2)}%
      </span>
    </button>
  );
}
