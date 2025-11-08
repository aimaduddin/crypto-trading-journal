"use client";

import { UserButton } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Edit3,
  PlusCircle,
  Trash2,
  X,
} from "lucide-react";

type TradeDirection = "Long" | "Short";

type Trade = {
  id: string;
  pair: string;
  direction: TradeDirection;
  strategy: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  date: string;
  sentiment: string;
  positionSize: number;
};

type TradeFormData = {
  pair: string;
  direction: TradeDirection;
  strategy: string;
  entryPrice: string;
  exitPrice: string;
  positionSize: string;
  date: string;
  sentiment: string;
};

type DirectionFilter = TradeDirection | "All";

type TradeFilters = {
  pair: string;
  direction: DirectionFilter;
  strategy: string;
  startDate: string;
  endDate: string;
};

type SortKey =
  | "date-desc"
  | "date-asc"
  | "pnl-desc"
  | "pnl-asc"
  | "size-desc"
  | "size-asc";

type TradeRow = {
  id: string;
  pair: string;
  direction: TradeDirection;
  strategy: string;
  entry_price: string | number | null;
  exit_price: string | number | null;
  pnl: string | number | null;
  position_size: string | number | null;
  sentiment: string | null;
  trade_date: string;
};

const parseNumericField = (value: string | number | null) => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const mapRowToTrade = (row: TradeRow): Trade => ({
  id: row.id,
  pair: row.pair,
  direction: row.direction,
  strategy: row.strategy,
  entryPrice: parseNumericField(row.entry_price),
  exitPrice: parseNumericField(row.exit_price),
  pnl: parseNumericField(row.pnl),
  date: row.trade_date,
  sentiment: row.sentiment ?? "",
  positionSize: parseNumericField(row.position_size),
});

const createDefaultFilters = (): TradeFilters => ({
  pair: "",
  direction: "All",
  strategy: "",
  startDate: "",
  endDate: "",
});

const sortSelectOptions: { label: string; value: SortKey }[] = [
  { label: "Newest first", value: "date-desc" },
  { label: "Oldest first", value: "date-asc" },
  { label: "PnL high → low", value: "pnl-desc" },
  { label: "PnL low → high", value: "pnl-asc" },
  { label: "Size high → low", value: "size-desc" },
  { label: "Size low → high", value: "size-asc" },
];

const sortTradesByDateDesc = (entries: Trade[]) =>
  [...entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

const calculatePnL = (
  direction: TradeDirection,
  entry: number,
  exit: number,
  size: number,
) => {
  if (!Number.isFinite(entry) || !Number.isFinite(exit) || !Number.isFinite(size)) {
    return 0;
  }

  const difference =
    direction === "Long" ? exit - entry : entry - exit;

  return difference * size;
};

const createEmptyFormState = (): TradeFormData => ({
  pair: "",
  direction: "Long",
  strategy: "",
  entryPrice: "",
  exitPrice: "",
  positionSize: "",
  date: new Date().toISOString().slice(0, 10),
  sentiment: "",
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const formatPnL = (value: number) => {
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}${formatCurrency(Math.abs(value))}`;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function Home() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TradeFormData>(() =>
    createEmptyFormState(),
  );
  const [showAllTrades, setShowAllTrades] = useState(false);
  const [pageSize, setPageSize] = useState(5);
  const [filters, setFilters] = useState<TradeFilters>(() =>
    createDefaultFilters(),
  );
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        setIsLoading(true);
        const { data, error: fetchError } = await supabase
          .from("trades")
          .select("*")
          .order("trade_date", { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        const mappedTrades = (data as TradeRow[] | null)?.map(mapRowToTrade) ?? [];
        setTrades(sortTradesByDateDesc(mappedTrades));
        setError(null);
      } catch (fetchErr) {
        console.error(fetchErr);
        setError(
          fetchErr instanceof Error
            ? fetchErr.message
            : "Failed to load trades.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrades();
  }, []);

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      if (
        filters.pair &&
        !trade.pair.toLowerCase().includes(filters.pair.trim().toLowerCase())
      ) {
        return false;
      }

      if (
        filters.strategy &&
        !trade.strategy
          .toLowerCase()
          .includes(filters.strategy.trim().toLowerCase())
      ) {
        return false;
      }

      if (filters.direction !== "All" && trade.direction !== filters.direction) {
        return false;
      }

      if (filters.startDate) {
        const startTime = new Date(filters.startDate).getTime();
        if (!Number.isNaN(startTime) && new Date(trade.date).getTime() < startTime) {
          return false;
        }
      }

      if (filters.endDate) {
        const endTime = new Date(filters.endDate).getTime();
        if (!Number.isNaN(endTime) && new Date(trade.date).getTime() > endTime) {
          return false;
        }
      }

      return true;
    });
  }, [filters, trades]);

  const sortedTrades = useMemo(() => {
    const entries = [...filteredTrades];
    entries.sort((a, b) => {
      const getDate = (value: string) => new Date(value).getTime();
      switch (sortKey) {
        case "date-asc":
          return getDate(a.date) - getDate(b.date);
        case "pnl-desc":
          return b.pnl - a.pnl;
        case "pnl-asc":
          return a.pnl - b.pnl;
        case "size-desc":
          return b.positionSize - a.positionSize;
        case "size-asc":
          return a.positionSize - b.positionSize;
        case "date-desc":
        default:
          return getDate(b.date) - getDate(a.date);
      }
    });
    return entries;
  }, [filteredTrades, sortKey]);

  const hasActiveFilters =
    filters.direction !== "All" ||
    Boolean(filters.pair.trim()) ||
    Boolean(filters.strategy.trim()) ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate);

  const totalPnL = filteredTrades.reduce((acc, trade) => acc + trade.pnl, 0);
  const totalTrades = filteredTrades.length;
  const winningTrades = filteredTrades.filter((trade) => trade.pnl > 0).length;
  const avgPnl = totalTrades > 0 ? totalPnL / totalTrades : 0;
  const longTrades = filteredTrades.filter((trade) => trade.direction === "Long").length;
  const shortTrades = totalTrades - longTrades;
  const losingTrades = totalTrades - winningTrades;
  const winRate =
    totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : 0;

  const stats = [
    {
      label: "Net PnL",
      value: formatPnL(totalPnL),
      change: totalPnL >= 0 ? "Above breakeven" : "Below breakeven",
      positive: totalPnL >= 0,
    },
    {
      label: "Win Rate",
      value: `${winRate}%`,
      change: `${winningTrades} wins · ${losingTrades} losses`,
      positive: winRate >= 50,
    },
    {
      label: "Trades Logged",
      value: `${totalTrades}`,
      change: `${longTrades} long · ${shortTrades} short`,
      positive: totalTrades > 0,
    },
    {
      label: "Avg PnL / Trade",
      value: formatPnL(avgPnl),
      change: avgPnl >= 0 ? "Profitable setups" : "Review exits",
      positive: avgPnl >= 0,
    },
  ];

  const openCreateModal = () => {
    setEditingTradeId(null);
    setFormData(createEmptyFormState());
    setIsModalOpen(true);
  };

  const openEditModal = (trade: Trade) => {
    setEditingTradeId(trade.id);
    setFormData({
      pair: trade.pair,
      direction: trade.direction,
      strategy: trade.strategy,
      entryPrice: trade.entryPrice.toString(),
      exitPrice: trade.exitPrice.toString(),
      positionSize: trade.positionSize.toString(),
      date: trade.date,
      sentiment: trade.sentiment,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTradeId(null);
    setFormData(createEmptyFormState());
  };

  const handleInputChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFilterChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
    setShowAllTrades(false);
  };

  const resetFilters = () => {
    setFilters(createDefaultFilters());
    setShowAllTrades(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.pair.trim()) {
      alert("Please enter a trading pair.");
      return;
    }

    if (!formData.strategy.trim()) {
      alert("Please enter a strategy name.");
      return;
    }

    const parsedEntry = parseFloat(formData.entryPrice);
    const parsedExit = parseFloat(formData.exitPrice);
    const parsedSize = parseFloat(formData.positionSize);

    const entryPrice = Number.isFinite(parsedEntry) ? parsedEntry : 0;
    const exitPrice = Number.isFinite(parsedExit) ? parsedExit : 0;
    const positionSize = Number.isFinite(parsedSize) ? parsedSize : 0;

    if (!Number.isFinite(parsedEntry) || !Number.isFinite(parsedExit)) {
      alert("Please enter valid numeric values for entry and exit price.");
      return;
    }

    if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      alert("Please enter a position size greater than zero.");
      return;
    }

    const pnl = calculatePnL(formData.direction, entryPrice, exitPrice, positionSize);
    const payload = {
      pair: formData.pair,
      direction: formData.direction,
      strategy: formData.strategy,
      entry_price: entryPrice,
      exit_price: exitPrice,
      position_size: positionSize,
      pnl,
      sentiment: formData.sentiment.trim() ? formData.sentiment : null,
      trade_date: formData.date,
    };

    setIsSubmitting(true);

    try {
      if (editingTradeId) {
        const { data, error: updateError } = await supabase
          .from("trades")
          .update(payload)
          .eq("id", editingTradeId)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        if (data) {
          const updatedTrade = mapRowToTrade(data as TradeRow);
          setTrades((prev) =>
            sortTradesByDateDesc(
              prev.map((trade) =>
                trade.id === editingTradeId ? updatedTrade : trade,
              ),
            ),
          );
        }
      } else {
        const { data, error: insertError } = await supabase
          .from("trades")
          .insert(payload)
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        if (data) {
          const createdTrade = mapRowToTrade(data as TradeRow);
          setTrades((prev) => sortTradesByDateDesc([createdTrade, ...prev]));
        }
      }

      closeModal();
    } catch (submitErr) {
      console.error(submitErr);
      alert(
        submitErr instanceof Error
          ? submitErr.message
          : "Failed to save trade. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const trade = trades.find((item) => item.id === id);
    const confirmationMessage = trade
      ? `Delete trade ${trade.pair} on ${formatDate(trade.date)}? This cannot be undone.`
      : "Delete this trade? This cannot be undone.";

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from("trades")
        .delete()
        .eq("id", id);

      if (deleteError) {
        throw deleteError;
      }

      setTrades((prev) => prev.filter((item) => item.id !== id));
    } catch (deleteErr) {
      console.error(deleteErr);
      alert(
        deleteErr instanceof Error
          ? deleteErr.message
          : "Failed to delete trade. Please try again.",
      );
    }
  };

  const calculatedPnL = useMemo(() => {
    const parsedEntry = parseFloat(formData.entryPrice);
    const parsedExit = parseFloat(formData.exitPrice);
    const parsedSize = parseFloat(formData.positionSize);

    if (
      !Number.isFinite(parsedEntry) ||
      !Number.isFinite(parsedExit) ||
      !Number.isFinite(parsedSize) ||
      parsedSize <= 0
    ) {
      return null;
    }

    return calculatePnL(formData.direction, parsedEntry, parsedExit, parsedSize);
  }, [formData.direction, formData.entryPrice, formData.exitPrice, formData.positionSize]);

  const hasMoreTrades = sortedTrades.length > pageSize;
  const visibleTrades = useMemo(
    () =>
      showAllTrades || !hasMoreTrades
        ? sortedTrades
        : sortedTrades.slice(0, pageSize),
    [showAllTrades, hasMoreTrades, sortedTrades, pageSize],
  );

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-50">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-20 pt-8 sm:px-6 sm:pb-24 sm:pt-12">
        <header className="flex flex-col justify-between gap-6 rounded-2xl border border-white/5 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 p-5 shadow-2xl shadow-slate-900/50 sm:rounded-3xl sm:p-8 md:flex-row md:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              <Activity className="h-4 w-4 text-emerald-400" />
              Daily Discipline
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-white">
              Crypto Trading Journal
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Track every trade, understand your edges, and review setups with
              intention. This workspace will evolve as we wire up data sources,
              analytics, and authentication.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 hover:text-emerald-100"
            >
              <PlusCircle className="h-4 w-4" />
              Log Trade
            </button>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-10 w-10",
                },
              }}
            />
          </div>
        </header>

        <section className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {stat.label}
              </p>
              <div className="mt-3 flex flex-col gap-3">
                <span className="text-3xl font-semibold text-white leading-tight">
                  {stat.value}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    stat.positive
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "bg-rose-500/10 text-rose-300"
                  }`}
                >
                  {stat.positive ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {stat.change}
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent Trades</h2>
              <p className="text-sm text-slate-400">
                Snapshot of the latest executions with notes and outcomes.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                Sort by
                <select
                  className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-[11px] font-semibold text-slate-200 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  value={sortKey}
                  onChange={(event) =>
                    setSortKey(event.target.value as SortKey)
                  }
                >
                  {sortSelectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                Page size
                <div className="flex gap-1">
                  {[5, 10, 20].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setPageSize(size);
                        setShowAllTrades(false);
                      }}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        pageSize === size
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                          : "border-white/10 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAllTrades((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!hasMoreTrades && !showAllTrades}
              >
                {showAllTrades ? "Collapse" : "View All Trades"}
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Pair
              <input
                type="text"
                name="pair"
                value={filters.pair}
                onChange={handleFilterChange}
                placeholder="Search pair"
                className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Strategy
              <input
                type="text"
                name="strategy"
                value={filters.strategy}
                onChange={handleFilterChange}
                placeholder="Search strategy"
                className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Direction
              <select
                name="direction"
                value={filters.direction}
                onChange={handleFilterChange}
                className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <option value="All">All directions</option>
                <option value="Long">Long</option>
                <option value="Short">Short</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Start Date
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              End Date
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <p>
              {filteredTrades.length} trade{filteredTrades.length === 1 ? "" : "s"} shown
              {hasActiveFilters ? " (filters applied)" : ""}.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear Filters
            </button>
          </div>
          {!showAllTrades && hasMoreTrades ? (
            <p className="mt-2 text-xs text-slate-500">
              Showing the latest {pageSize} trades. Use “View All Trades” to expand the full log.
            </p>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              Unable to load trades right now: {error}
            </div>
          ) : null}
          <div className="mt-6 space-y-3 md:hidden">
            {isLoading ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-400">
                Loading trades...
              </div>
            ) : visibleTrades.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-400">
                No trades logged yet. Use “Log Trade” to add your first entry.
              </div>
            ) : (
              visibleTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-white">
                        {trade.pair}
                      </p>
                      {trade.sentiment ? (
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          {trade.sentiment}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        trade.direction === "Long"
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-sky-500/10 text-sky-300"
                      }`}
                    >
                      {trade.direction}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                        Strategy
                      </p>
                      <p className="font-medium text-slate-200">{trade.strategy}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                        Size
                      </p>
                      <p className="font-medium text-slate-200">{trade.positionSize}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                        Entry
                      </p>
                      <p>{formatCurrency(trade.entryPrice)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                        Exit
                      </p>
                      <p>{formatCurrency(trade.exitPrice)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                        Logged
                      </p>
                      <p>{formatDate(trade.date)}</p>
                    </div>
                    <p
                      className={`text-base font-semibold ${
                        trade.pnl >= 0 ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {formatPnL(trade.pnl)}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(trade)}
                      className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/15"
                      aria-label="Edit trade"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(trade.id)}
                      className="inline-flex items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 p-2 text-rose-300 transition hover:bg-rose-500/20"
                      aria-label="Delete trade"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 hidden overflow-x-auto md:block">
            <div className="min-w-[640px] overflow-hidden rounded-xl border border-white/5">
              <table className="w-full divide-y divide-white/5 text-sm">
                <thead className="bg-slate-950/60 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Pair</th>
                    <th className="px-4 py-3 font-medium">Direction</th>
                    <th className="px-4 py-3 font-medium">Strategy</th>
                    <th className="px-4 py-3 font-medium text-right">Size</th>
                    <th className="px-4 py-3 font-medium">Entry</th>
                    <th className="px-4 py-3 font-medium">Exit</th>
                    <th className="px-4 py-3 font-medium text-right">PnL</th>
                    <th className="px-4 py-3 font-medium text-right">Logged</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-slate-950/40 text-slate-300">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-6 text-center text-sm text-slate-400"
                      >
                        Loading trades...
                      </td>
                    </tr>
                  ) : visibleTrades.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-6 text-center text-sm text-slate-400"
                      >
                        No trades logged yet. Use “Log Trade” to add your first entry.
                      </td>
                    </tr>
                  ) : (
                    visibleTrades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-white/5">
                        <td className="px-4 py-4 font-semibold text-white">
                          {trade.pair}
                          {trade.sentiment ? (
                            <span className="ml-2 rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                              {trade.sentiment}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              trade.direction === "Long"
                                ? "bg-emerald-500/10 text-emerald-300"
                                : "bg-sky-500/10 text-sky-300"
                            }`}
                          >
                            {trade.direction}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-300">
                          {trade.strategy}
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-slate-300">
                          {trade.positionSize}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-300">
                          {formatCurrency(trade.entryPrice)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-300">
                          {formatCurrency(trade.exitPrice)}
                        </td>
                        <td
                          className={`px-4 py-4 text-right text-sm font-semibold ${
                            trade.pnl >= 0 ? "text-emerald-300" : "text-rose-300"
                          }`}
                        >
                          {formatPnL(trade.pnl)}
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-slate-400">
                          {formatDate(trade.date)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(trade)}
                              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/15"
                              aria-label="Edit trade"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(trade.id)}
                              className="inline-flex items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 p-2 text-rose-300 transition hover:bg-rose-500/20"
                              aria-label="Delete trade"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/70 outline-none md:max-h-[92vh] md:overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-lg font-semibold text-white">
                {editingTradeId ? "Edit Trade" : "Log Trade"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white/10"
                aria-label="Close trade form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  Pair
                  <input
                    className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    name="pair"
                    value={formData.pair}
                    onChange={handleInputChange}
                    placeholder="e.g. BTC / USDT"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  Direction
                  <select
                    className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    name="direction"
                    value={formData.direction}
                    onChange={handleInputChange}
                  >
                    <option value="Long">Long</option>
                    <option value="Short">Short</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  Strategy
                  <input
                    className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    name="strategy"
                    value={formData.strategy}
                    onChange={handleInputChange}
                    placeholder="Setup name"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  Logged Date
                  <input
                    type="date"
                    className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  Entry Price
                  <input
                    type="number"
                    step="0.01"
                    className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    name="entryPrice"
                    value={formData.entryPrice}
                    onChange={handleInputChange}
                    placeholder="61250"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  Exit Price
                  <input
                    type="number"
                    step="0.01"
                    className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    name="exitPrice"
                    value={formData.exitPrice}
                    onChange={handleInputChange}
                    placeholder="63100"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-300 sm:col-span-2">
                  Position Size (units)
                  <input
                    type="number"
                    step="0.01"
                    className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    name="positionSize"
                    value={formData.positionSize}
                    onChange={handleInputChange}
                    placeholder="e.g. 0.5"
                    required
                  />
                </label>
              </div>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Sentiment / Notes
                <textarea
                  className="min-h-[96px] rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  name="sentiment"
                  value={formData.sentiment}
                  onChange={handleInputChange}
                  placeholder="Confidence, checklist notes, lessons..."
                />
              </label>
              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Calculated PnL
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {calculatedPnL === null
                    ? "Enter entry, exit, and size"
                    : formatPnL(calculatedPnL)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  PnL = ({formData.direction === "Long" ? "Exit − Entry" : "Entry − Exit"}) ×
                  Size
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Saving..." : "Save Trade"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
