import { useMemo, useState } from "react";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

import {
  Upload,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  FileText,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Activity,
  Receipt,
  CircleDollarSign,
  Zap,
  IndianRupee,
  X,
} from "lucide-react";

/* =========================================================
   CONSTANTS
========================================================= */

const COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#f97316",
  "#ec4899",
  "#64748b",
];

/* =========================================================
   FORMATTERS
========================================================= */

function formatMoney(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatCompactMoney(value) {
  const amount = Number(value || 0);

  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }

  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }

  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function formatDate(date) {
  if (!date) return "—";

  const value = String(date);
  const parts = value.split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}

function formatShortDate(date) {
  if (!date) return "";

  const value = String(date);
  const parts = value.split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }

  return value;
}

/* =========================================================
   HELPERS
========================================================= */

function shortenMerchant(name) {
  if (!name) return "Unknown";

  let merchant = String(name).trim();

  merchant = merchant
    .replace(/^Jun\s+/i, "")
    .replace(/^Jul\s+/i, "")
    .replace(/^Aug\s+/i, "")
    .replace(/^Sep\s+/i, "")
    .replace(/^Oct\s+/i, "")
    .replace(/^Nov\s+/i, "")
    .replace(/^Dec\s+/i, "");

  const replacements = [
    ["ATM WITHDRAWAL SELF-SWITCH", "ATM Withdrawal"],
    ["WITHDRAWAL SELF-SWITCH", "ATM Withdrawal"],
    ["TM ATM Withdrawal", "ATM Withdrawal"],
    ["TM ATM WITHDRAWAL", "ATM Withdrawal"],
    ["ATM WITHDRAWAL", "ATM Withdrawal"],
    ["MPS/P2A/", "Transfer"],
    ["P2A/", "Transfer"],
    ["PI/", "UPI / "],
    ["UPI/", "UPI / "],
    ["UUPI /", "UPI /"],
    ["UUPI/", "UPI /"],
  ];

  for (const [from, to] of replacements) {
    merchant = merchant.replace(from, to);
  }

  merchant = merchant
    .replace(/\s+/g, " ")
    .replace(/\/+$/, "")
    .trim();

  if (merchant.length > 25) {
    return `${merchant.slice(0, 25)}…`;
  }

  return merchant;
}

function getCategoryIcon(category) {
  const value = String(category || "").toLowerCase();

  if (value.includes("shopping")) return "Shopping";
  if (value.includes("travel")) return "Travel";
  if (value.includes("cash")) return "Cash";
  if (value.includes("food")) return "Food";
  if (value.includes("fee")) return "Fees";
  if (value.includes("upi")) return "UPI";
  if (value.includes("transfer")) return "Transfer";
  if (value.includes("income")) return "Income";

  return "Other";
}

/* =========================================================
   APP
========================================================= */

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);

  function handleFile(selectedFile) {
    if (!selectedFile) {
      setFile(null);
      setError("");
      return;
    }
  
    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please upload a PDF bank statement.");
      return;
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      setError("Please upload a PDF smaller than 25 MB.");
      return;
    }

    setFile(selectedFile);
    setError("");
  }

  async function analyzeStatement() {
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const API_URL =
      import.meta.env.VITE_API_URL?.trim() || "http://127.0.0.1:8000";

      const response = await fetch(
        `${API_URL}/upload-statement`,
        {
          method: "POST",
          body: formData,
        }
      );
      
      let data = null;
      
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      
      if (!response.ok) {
        throw new Error(
          data?.detail?.message ||
            data?.detail ||
            data?.message ||
            `Server error (${response.status}). Please try again.`
        );
      }
      
      if (!data || typeof data !== "object") {
        throw new Error(
          "The server returned an invalid analysis response."
        );
      }
      
      setDashboard(data);
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          "Unable to connect to the analysis server. Make sure the FastAPI backend is running."
        );
      } else {
        setError(
          err.message ||
            "Something went wrong while analyzing the statement."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function resetProject() {
    setFile(null);
    setDashboard(null);
    setError("");
  }

  if (dashboard) {
    return (
      <Dashboard
        data={dashboard}
        onReset={resetProject}
      />
    );
  }

  return (
    <UploadScreen
      file={file}
      setFile={handleFile}
      onAnalyze={analyzeStatement}
      loading={loading}
      error={error}
    />
  );
}

/* =========================================================
   UPLOAD SCREEN
========================================================= */

function UploadScreen({
  file,
  setFile,
  onAnalyze,
  loading,
  error,
}) {
  const [dragActive, setDragActive] = useState(false);

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);

    const droppedFile = event.dataTransfer.files?.[0];

    if (droppedFile) {
      setFile(droppedFile);
    }
  }

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      setFile(selectedFile);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#090a0d] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-250px] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/[0.10] blur-[140px]" />

        <div className="absolute bottom-[-300px] left-[-150px] h-[500px] w-[500px] rounded-full bg-indigo-600/[0.06] blur-[130px]" />

        <div className="absolute right-[-200px] top-[40%] h-[450px] w-[450px] rounded-full bg-purple-500/[0.04] blur-[130px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/[0.05]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/20">
              <IndianRupee size={17} />
            </div>

            <div>
              <p className="text-sm font-semibold tracking-tight">
                Where Is My Money Going?
              </p>

              <p className="hidden text-[11px] text-slate-600 sm:block">
                Personal finance intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/40" />

            <span className="text-[11px] font-medium text-slate-500">
              Local & private
            </span>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        {/* Hero */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-violet-400/15 bg-violet-400/[0.06] px-3 py-1.5 text-[11px] font-medium text-violet-300">
            <Sparkles size={13} />

            Turn a bank statement into clarity
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
            Understand where

            <span className="block bg-gradient-to-r from-violet-300 via-purple-300 to-indigo-300 bg-clip-text text-transparent">
              your money goes.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
            Upload your bank statement and get a clear breakdown of
            income, spending, savings, merchants and transaction
            activity.
          </p>
        </div>

        {/* Upload */}
        <div className="mx-auto mt-12 max-w-3xl">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`relative overflow-hidden rounded-3xl border transition-all duration-300 ${
              dragActive
                ? "border-violet-400/50 bg-violet-500/[0.08] shadow-[0_0_80px_rgba(124,58,237,.14)]"
                : "border-white/[0.08] bg-[#111318]/90"
            }`}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />

            <div className="p-6 sm:p-10">
              <div className="flex flex-col items-center text-center">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl border transition ${
                    dragActive
                      ? "border-violet-400/30 bg-violet-400/10 text-violet-300"
                      : "border-white/[0.07] bg-white/[0.035] text-slate-400"
                  }`}
                >
                  <Upload size={25} />
                </div>

                <h2 className="mt-5 text-lg font-semibold text-white">
                  Drop your bank statement here
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  PDF files only · Maximum 25 MB
                </p>

                <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#090a0d] transition hover:bg-slate-200">
                  <FileText size={16} />

                  Choose PDF

                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              {/* Selected file */}
              {file && (
                <div className="mt-7 flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.045] p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                      <CheckCircle2 size={18} />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">
                        {file.name}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-600">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                        {" · "}
                        Ready to analyze
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="shrink-0 rounded-lg p-2 text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-300"
                    title="Remove file"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-5 rounded-xl border border-rose-400/10 bg-rose-400/[0.05] p-4 text-left">
                  <div className="flex gap-3">
                    <AlertTriangle
                      size={17}
                      className="mt-0.5 shrink-0 text-rose-400"
                    />

                    <div>
                      <p className="text-sm font-medium text-rose-300">
                        Upload failed
                      </p>

                      <p className="mt-1 text-xs leading-5 text-rose-300/60">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Analyze button */}
              <button
                type="button"
                onClick={onAnalyze}
                disabled={!file || loading}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/20 transition hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                    Analyzing statement...
                  </>
                ) : (
                  <>
                    Analyze Statement

                    <ArrowUpRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3">
          <Feature
            icon={Activity}
            title="Spending patterns"
            description="See how your spending is distributed across categories and merchants."
          />

          <Feature
            icon={TrendingUp}
            title="Cash flow"
            description="Understand income, expenses and the resulting savings from your statement."
          />

          <Feature
            icon={ShieldCheck}
            title="Private analysis"
            description="Your uploaded statement is analyzed by your local application."
          />
        </div>

        {/* Capabilities */}
        <div className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[11px] text-slate-700">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={13} />
            PDF statement parsing
          </span>

          <span className="hidden h-1 w-1 rounded-full bg-slate-800 sm:block" />

          <span className="flex items-center gap-2">
            <CheckCircle2 size={13} />
            Transaction-level analysis
          </span>

          <span className="hidden h-1 w-1 rounded-full bg-slate-800 sm:block" />

          <span className="flex items-center gap-2">
            <CheckCircle2 size={13} />
            Financial insights
          </span>
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({ data, onReset }) {
  const analytics = data?.analytics || {};

  const transactions = Array.isArray(data?.transactions)
    ? data.transactions
    : [];

  const categoryData = useMemo(() => {
    const source = Array.isArray(analytics.category_spending)
      ? analytics.category_spending.map((item) => ({
          category: item.category,
          amount: Number(item.amount || 0),
        }))
      : Object.entries(analytics.category_spending || {}).map(
          ([category, amount]) => ({
            category,
            amount: Number(amount || 0),
          })
        );

    const total = Number(analytics.total_spending || 0);

    return source
      .map((item) => ({
        ...item,
        percentage:
          total > 0
            ? ((item.amount / total) * 100).toFixed(1)
            : "0.0",
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [analytics]);

  const merchantData = useMemo(() => {
    return (analytics.top_merchants || [])
      .slice(0, 8)
      .map((item) => ({
        ...item,
        displayMerchant: shortenMerchant(item.merchant),
        amount: Number(item.amount || 0),
      }));
  }, [analytics.top_merchants]);

  const timelineData = useMemo(() => {
    return (analytics.daily_spending || []).map((item) => ({
      ...item,
      amount: Number(item.amount || 0),
    }));
  }, [analytics.daily_spending]);

  const anomalies = Array.isArray(analytics.anomalies)
    ? analytics.anomalies
    : [];

  const insights = Array.isArray(data?.ai_insights)
    ? data.ai_insights
    : [];

  const totalIncome = Number(analytics.total_income || 0);
  const totalSpending = Number(analytics.total_spending || 0);
  const savings = Number(analytics.savings || 0);
  const savingsRate = Number(analytics.savings_rate || 0);

  const spendingPercentage =
    totalIncome > 0
      ? (totalSpending / totalIncome) * 100
      : 0;

  return (
    <main className="min-h-screen bg-[#07080c] text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[35%] top-[-350px] h-[600px] w-[700px] rounded-full bg-violet-600/[0.045] blur-[140px]" />

        <div className="absolute bottom-[-300px] right-[-200px] h-[500px] w-[500px] rounded-full bg-blue-600/[0.035] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-5 py-6 sm:px-8 lg:px-10">
        {/* Header */}
        <header className="border-b border-white/[0.07] pb-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-400/10 bg-violet-500/[0.07] text-violet-300 sm:flex">
                <Wallet size={20} />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/50" />

                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-300">
                    Financial Intelligence
                  </p>
                </div>

                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                  Your money, decoded.
                </h1>

                <div className="mt-2 flex max-w-full items-center gap-2 text-xs text-slate-600">
                  <FileText size={13} />

                  <span className="max-w-[300px] truncate">
                    {data?.filename || "Bank statement"}
                  </span>

                  <span>•</span>

                  <span>
                    {data?.transaction_count ||
                      transactions.length ||
                      0}{" "}
                    transactions
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onReset}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-xs font-medium text-slate-400 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
            >
              <RotateCcw size={15} />

              Analyze another statement
            </button>
          </div>
        </header>

        {/* Overview */}
        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
              Statement overview
            </p>

            <div className="hidden items-center gap-2 text-xs text-slate-600 sm:flex">
              <CheckCircle2
                size={13}
                className="text-emerald-500"
              />

              Analysis complete
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total income"
              value={formatMoney(totalIncome)}
              icon={ArrowUpRight}
              iconClass="border-emerald-400/10 bg-emerald-400/[0.07] text-emerald-400"
              description="Money received"
            />

            <StatCard
              label="Total spending"
              value={formatMoney(totalSpending)}
              icon={ArrowDownRight}
              iconClass="border-violet-400/10 bg-violet-400/[0.07] text-violet-300"
              description="Money spent"
            />

            <StatCard
              label="Net savings"
              value={formatMoney(savings)}
              icon={Wallet}
              iconClass="border-blue-400/10 bg-blue-400/[0.07] text-blue-400"
              description={
                savings >= 0
                  ? "Net amount saved"
                  : "Negative balance"
              }
              positive={savings >= 0}
            />

            <StatCard
              label="Savings rate"
              value={`${savingsRate.toFixed(2)}%`}
              icon={TrendingUp}
              iconClass="border-amber-400/10 bg-amber-400/[0.07] text-amber-400"
              description="Of recorded income"
            />
          </div>
        </section>

        {/* Charts */}
        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          {/* Spending Breakdown */}
          <Card
            title="Spending breakdown"
            subtitle="Where your money went"
            icon={CircleDollarSign}
          >
            {categoryData.length > 0 ? (
              <>
                <div className="relative h-[300px]">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={78}
                        outerRadius={112}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {categoryData.map((_, index) => (
                          <Cell
                            key={index}
                            fill={
                              COLORS[
                                index % COLORS.length
                              ]
                            }
                          />
                        ))}
                      </Pie>

                      <Tooltip
                        formatter={(value) =>
                          formatMoney(value)
                        }
                        contentStyle={{
                          background: "#101116",
                          border:
                            "1px solid rgba(255,255,255,.09)",
                          borderRadius: "12px",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-[10px] uppercase tracking-[0.15em] text-slate-600">
                        Total
                      </p>

                      <p className="mt-1 text-lg font-semibold tracking-tight">
                        {formatCompactMoney(
                          totalSpending
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-x-5 gap-y-3 border-t border-white/[0.06] pt-5 sm:grid-cols-2">
                  {categoryData.slice(0, 8).map(
                    (item, index) => (
                      <div
                        key={item.category}
                        className="flex min-w-0 items-center justify-between gap-3"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              background:
                                COLORS[
                                  index %
                                    COLORS.length
                                ],
                            }}
                          />

                          <span className="truncate text-xs text-slate-500">
                            {item.category}
                          </span>
                        </div>

                        <span className="shrink-0 text-xs font-semibold text-slate-300">
                          {item.percentage}%
                        </span>
                      </div>
                    )
                  )}
                </div>
              </>
            ) : (
              <EmptyState
                title="No spending data"
                description="No categorized spending was returned by the analysis."
              />
            )}
          </Card>

          {/* Top Merchants */}
          <Card
            title="Top merchants"
            subtitle="Your biggest spending destinations"
            icon={Receipt}
          >
            <div className="h-[420px]">
              {merchantData.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={merchantData}
                    layout="vertical"
                    margin={{
                      top: 5,
                      right: 25,
                      left: 5,
                      bottom: 5,
                    }}
                    barCategoryGap="22%"
                  >
                    <CartesianGrid
                      horizontal={false}
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,.055)"
                    />

                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "#475569",
                        fontSize: 10,
                      }}
                      tickFormatter={formatCompactMoney}
                    />

                    <YAxis
                      type="category"
                      dataKey="displayMerchant"
                      width={128}
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "#94a3b8",
                        fontSize: 10,
                      }}
                    />

                    <Tooltip
                      cursor={{
                        fill: "rgba(139,92,246,.04)",
                      }}
                      formatter={(value) =>
                        formatMoney(value)
                      }
                      contentStyle={{
                        background: "#101116",
                        border:
                          "1px solid rgba(255,255,255,.09)",
                        borderRadius: "12px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />

                    <Bar
                      dataKey="amount"
                      fill="#8b5cf6"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={25}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="No merchant data"
                  description="No merchant spending information was returned."
                />
              )}
            </div>
          </Card>

          {/* Timeline */}
          <Card
            title="Spending over time"
            subtitle="Debit activity across your statement"
            icon={Activity}
          >
            <div className="h-[320px]">
              {timelineData.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart
                    data={timelineData}
                    margin={{
                      top: 12,
                      right: 15,
                      left: 5,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,.055)"
                    />

                    <XAxis
                      dataKey="date"
                      interval="preserveStartEnd"
                      minTickGap={45}
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "#475569",
                        fontSize: 10,
                      }}
                      tickFormatter={formatShortDate}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tick={{
                        fill: "#475569",
                        fontSize: 10,
                      }}
                      tickFormatter={formatCompactMoney}
                    />

                    <Tooltip
                      cursor={{
                        stroke:
                          "rgba(139,92,246,.25)",
                        strokeDasharray: "4 4",
                      }}
                      labelFormatter={(label) =>
                        formatDate(label)
                      }
                      formatter={(value) =>
                        formatMoney(value)
                      }
                      contentStyle={{
                        background: "#101116",
                        border:
                          "1px solid rgba(255,255,255,.09)",
                        borderRadius: "12px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      dot={{
                        r: 2.5,
                        fill: "#8b5cf6",
                        strokeWidth: 0,
                      }}
                      activeDot={{
                        r: 5,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="No timeline data"
                  description="No daily spending information was returned."
                />
              )}
            </div>
          </Card>

          {/* Savings */}
          <Card
            title="Savings vs spending"
            subtitle="How your recorded income was distributed"
            icon={TrendingUp}
          >
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="w-full max-w-md space-y-9">
                <Progress
                  label="Spending"
                  value={spendingPercentage}
                  amount={totalSpending}
                  textClass="text-violet-300"
                />

                <Progress
                  label="Savings"
                  value={savingsRate}
                  amount={savings}
                  textClass="text-emerald-400"
                />

                <div className="flex items-center justify-between px-1 text-xs text-slate-600">
                  <span>Recorded income</span>

                  <span className="font-medium text-slate-400">
                    {formatMoney(totalIncome)}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Insights */}
        <section className="mt-5">
          <Card
            title="Financial insights"
            subtitle="Observations generated from your analyzed transaction data"
            icon={Sparkles}
          >
            {insights.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-3">
                {insights.map((insight, index) => (
                  <div
                    key={index}
                    className="group relative overflow-hidden rounded-2xl border border-violet-400/[0.08] bg-gradient-to-br from-violet-500/[0.07] to-transparent p-5 transition hover:border-violet-400/[0.15]"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-violet-500/[0.06] blur-2xl" />

                    <div className="relative">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                          <Sparkles size={15} />
                        </div>

                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                          Insight {index + 1}
                        </span>
                      </div>

                      <p className="text-sm leading-6 text-slate-300">
                        {insight}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No insights available"
                description="The analysis did not return additional financial insights."
              />
            )}
          </Card>
        </section>

        {/* Anomalies */}
        <section className="mt-5">
          <Card
            title="Anomaly detection"
            subtitle="Transactions that stand out statistically"
            icon={AlertTriangle}
          >
            {anomalies.length === 0 ? (
              <div className="flex flex-col gap-4 rounded-2xl border border-emerald-500/[0.10] bg-emerald-500/[0.035] p-5 sm:flex-row sm:items-center">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/10 bg-emerald-500/[0.07] text-emerald-400">
                  <ShieldCheck size={20} />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">
                      No unusual transactions identified
                    </p>

                    <CheckCircle2
                      size={14}
                      className="text-emerald-500"
                    />
                  </div>

                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    No statistically unusual transactions
                    were identified in the current analysis.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {anomalies.map((anomaly, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-4 rounded-2xl border border-red-500/[0.10] bg-red-500/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                        <AlertTriangle size={18} />
                      </div>

                      <div>
                        <p className="text-sm font-medium">
                          {shortenMerchant(
                            anomaly.merchant
                          )}
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          {formatDate(anomaly.date)} ·{" "}
                          {anomaly.reason}
                        </p>
                      </div>
                    </div>

                    <p className="font-semibold text-red-300">
                      {formatMoney(anomaly.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* Transactions */}
        <section className="mt-5">
          <Card
            title="Detected transactions"
            subtitle={`${data?.transaction_count || transactions.length || 0} transactions extracted from the statement`}
            icon={Receipt}
          >
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/[0.08] text-violet-300">
                  <Zap size={16} />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-300">
                    Statement processed
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-600">
                    All extracted transactions are shown below.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-emerald-500">
                <CheckCircle2 size={13} />
                Extraction complete
              </div>
            </div>

            <TransactionTable
              transactions={transactions}
            />
          </Card>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/[0.05] py-10">
          <div className="flex flex-col items-center justify-center gap-2 text-center text-[11px] text-slate-700 sm:flex-row">
            <span>
              {data?.transaction_count ||
                transactions.length ||
                0}{" "}
              transactions extracted
            </span>

            <span className="hidden sm:block">•</span>

            <span>
              Financial analysis completed locally
            </span>

            <span className="hidden sm:block">•</span>

            <span>Private by design</span>
          </div>
        </footer>
      </div>
    </main>
  );
}

/* =========================================================
   TRANSACTION TABLE
========================================================= */

function TransactionTable({ transactions }) {
  if (!transactions.length) {
    return (
      <EmptyState
        title="No transactions detected"
        description="The statement did not return any transaction records."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.07] bg-white/[0.018] text-[10px] uppercase tracking-[0.14em] text-slate-600">
              <th className="px-4 py-4 font-medium">
                Date
              </th>

              <th className="px-4 py-4 font-medium">
                Merchant
              </th>

              <th className="px-4 py-4 font-medium">
                Category
              </th>

              <th className="px-4 py-4 text-right font-medium">
                Amount
              </th>

              <th className="px-4 py-4 font-medium">
                Type
              </th>
            </tr>
          </thead>

          <tbody>
            {transactions.map((transaction, index) => {
              const isCredit =
                String(transaction.type || "").toLowerCase() ===
                "credit";

              return (
                <tr
                  key={
                    transaction.id ??
                    `${transaction.date}-${index}`
                  }
                  className="group border-b border-white/[0.04] transition last:border-b-0 hover:bg-white/[0.025]"
                >
                  {/* Date */}
                  <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">
                    {formatDate(transaction.date)}
                  </td>

                  {/* Merchant */}
                  <td className="max-w-[300px] px-4 py-4">
                    <div
                      className="flex items-center gap-3"
                      title={transaction.merchant || "Unknown"}
                    >
                      <div
                        className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex ${
                          isCredit
                            ? "bg-emerald-500/[0.07] text-emerald-400"
                            : "bg-white/[0.04] text-slate-500"
                        }`}
                      >
                        {isCredit ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )}
                      </div>

                      <span className="truncate text-xs font-medium text-slate-300">
                        {shortenMerchant(
                          transaction.merchant
                        )}
                      </span>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 text-[10px] font-medium text-slate-500">
                      {getCategoryIcon(
                        transaction.category
                      )}
                    </span>
                  </td>

                  {/* Amount */}
                  <td
                    className={`whitespace-nowrap px-4 py-4 text-right text-xs font-semibold ${
                      isCredit
                        ? "text-emerald-400"
                        : "text-slate-200"
                    }`}
                  >
                    {isCredit ? "+" : "-"}
                    {formatMoney(transaction.amount)}
                  </td>

                  {/* Type */}
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                        isCredit
                          ? "bg-emerald-500/[0.08] text-emerald-400"
                          : "bg-white/[0.04] text-slate-500"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isCredit
                            ? "bg-emerald-400"
                            : "bg-rose-400"
                        }`}
                      />

                      <span>
                        {isCredit ? "Credit" : "Debit"}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
  description,
  positive,
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111318]/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,.18)] transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.12]">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-violet-500/[0.05] blur-2xl transition duration-500 group-hover:bg-violet-500/[0.10]" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl border ${iconClass}`}
          >
            <Icon size={18} strokeWidth={2} />
          </div>

          {positive !== undefined && (
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                positive
                  ? "bg-emerald-400/10 text-emerald-400"
                  : "bg-rose-400/10 text-rose-400"
              }`}
            >
              {positive ? "Positive" : "Negative"}
            </span>
          )}
        </div>

        <p className="mt-5 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>

        <p className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
          {value}
        </p>

        {description && (
          <p className="mt-2 text-xs leading-5 text-slate-600">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   CARD
========================================================= */

function Card({
  title,
  subtitle,
  icon: Icon,
  children,
  className = "",
  action,
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111318]/90 shadow-[0_20px_60px_rgba(0,0,0,.16)] ${className}`}
    >
      <div className="flex items-start justify-between border-b border-white/[0.05] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-slate-400">
              <Icon size={17} />
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              {title}
            </h3>

            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-600">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {action}
      </div>

      <div className="p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}

/* =========================================================
   PROGRESS
========================================================= */

function Progress({
  label,
  value,
  amount,
  textClass,
}) {
  const safeValue = Number(value || 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-slate-400">
          {label}
        </span>

        <span
          className={`font-semibold ${textClass}`}
        >
          {safeValue.toFixed(1)}%
        </span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={`h-full rounded-full bg-current transition-all duration-700 ${textClass}`}
          style={{
            width: `${Math.min(
              100,
              Math.max(0, safeValue)
            )}%`,
          }}
        />
      </div>

      <p className="mt-2 text-sm text-slate-500">
        {formatMoney(amount)}
      </p>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  icon: Icon = FileText,
  title = "No data available",
  description = "There is not enough data to display this section.",
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-slate-600">
        <Icon size={20} />
      </div>

      <p className="mt-4 text-sm font-medium text-slate-400">
        {title}
      </p>

      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-600">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   FEATURE
========================================================= */

function Feature({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.018] p-5 transition duration-300 hover:border-white/[0.1] hover:bg-white/[0.025]">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-violet-300 transition group-hover:border-violet-400/20 group-hover:bg-violet-400/[0.07]">
        <Icon size={18} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-200">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-600">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   EXPORT
========================================================= */

export default App;