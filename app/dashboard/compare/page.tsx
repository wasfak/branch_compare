"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

type PeriodType = "year" | "quarter";
type Metric = "units" | "value";
type CompareMode = "period" | "branch" | "company";

type Period = {
  type: PeriodType;
  year: number;
  quarter: 1 | 2 | 3 | 4;
};

type BranchTotal = { branch: string; total: number };
type CompareResult = { overall: number; branches: BranchTotal[] };

const fieldClass =
  "h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-input dark:bg-input/30";

const QUARTER_MONTHS: Record<1 | 2 | 3 | 4, [number, number]> = {
  1: [0, 2],
  2: [3, 5],
  3: [6, 8],
  4: [9, 11],
};

// Converts a chosen period (a year, or a year + quarter) into a from/to date range.
function periodToRange(period: Period): { from: string; to: string } {
  const pad = (n: number) => String(n + 1).padStart(2, "0");
  if (period.type === "year") {
    return { from: `${period.year}-01-01`, to: `${period.year}-12-31` };
  }
  const [startMonth, endMonth] = QUARTER_MONTHS[period.quarter];
  const lastDay = new Date(Date.UTC(period.year, endMonth + 1, 0)).getUTCDate();
  return {
    from: `${period.year}-${pad(startMonth)}-01`,
    to: `${period.year}-${pad(endMonth)}-${String(lastDay).padStart(2, "0")}`,
  };
}

function periodLabel(period: Period): string {
  return period.type === "year" ? `Year ${period.year}` : `Q${period.quarter} ${period.year}`;
}

// Renders a green up arrow / red down arrow with the % change between two totals.
function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return current > 0 ? (
      <span className="inline-flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
        <ArrowUp className="h-4 w-4" /> New
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="h-4 w-4" /> —
      </span>
    );
  }

  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="h-4 w-4" /> 0.0%
      </span>
    );
  }

  const up = change > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium ${
        up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      }`}
    >
      {up ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
      {up ? "+" : ""}
      {change.toFixed(1)}%
    </span>
  );
}

function formatTotal(value: number, metric: Metric): string {
  return metric === "value"
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : value.toLocaleString();
}

function PeriodPicker({
  label,
  period,
  onChange,
}: {
  label: string;
  period: Period;
  onChange: (next: Period) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Compare by</label>
          <select
            className={fieldClass}
            value={period.type}
            onChange={(e) => onChange({ ...period, type: e.target.value as PeriodType })}
          >
            <option value="year">Year</option>
            <option value="quarter">Quarter</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Year</label>
          <input
            type="number"
            className={`${fieldClass} w-24`}
            value={period.year}
            onChange={(e) => onChange({ ...period, year: Number(e.target.value) || period.year })}
          />
        </div>

        {period.type === "quarter" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Quarter</label>
            <select
              className={fieldClass}
              value={period.quarter}
              onChange={(e) =>
                onChange({ ...period, quarter: Number(e.target.value) as 1 | 2 | 3 | 4 })
              }
            >
              <option value={1}>Q1 (Jan–Mar)</option>
              <option value={2}>Q2 (Apr–Jun)</option>
              <option value={3}>Q3 (Jul–Sep)</option>
              <option value={4}>Q4 (Oct–Dec)</option>
            </select>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{periodLabel(period)}</p>
    </div>
  );
}

type QuarterRow = { label: string; a: number; b: number };

// Table showing Q1–Q4 side by side for two labelled series, plus an "All quarters" total row.
function QuarterBreakdownTable({
  rows,
  labelA,
  labelB,
  metric,
}: {
  rows: QuarterRow[];
  labelA: string;
  labelB: string;
  metric: Metric;
}) {
  const totalA = rows.reduce((sum, r) => sum + r.a, 0);
  const totalB = rows.reduce((sum, r) => sum + r.b, 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-card/50 text-left">
            <th className="px-3 py-2 font-medium">Quarter</th>
            <th className="px-3 py-2 text-right font-medium">{labelA}</th>
            <th className="px-3 py-2 text-right font-medium">{labelB}</th>
            <th className="px-3 py-2 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border last:border-0">
              <td className="px-3 py-2">{row.label}</td>
              <td className="px-3 py-2 text-right">{formatTotal(row.a, metric)}</td>
              <td className="px-3 py-2 text-right">{formatTotal(row.b, metric)}</td>
              <td className="px-3 py-2 text-right">
                <ChangeIndicator current={row.a} previous={row.b} />
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-border font-medium">
            <td className="px-3 py-2">All quarters</td>
            <td className="px-3 py-2 text-right">{formatTotal(totalA, metric)}</td>
            <td className="px-3 py-2 text-right">{formatTotal(totalB, metric)}</td>
            <td className="px-3 py-2 text-right">
              <ChangeIndicator current={totalA} previous={totalB} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const MODE_LABELS: Record<CompareMode, string> = {
  period: "Compare two periods",
  branch: "Compare two branches",
  company: "Compare two companies",
};

export default function ComparePage() {
  const currentYear = new Date().getFullYear();

  const [mode, setMode] = useState<CompareMode>("period");
  const [metric, setMetric] = useState<Metric>("units");
  // When enabled, instead of one head-to-head total, breaks the comparison down into Q1–Q4
  // (using each side's selected year), so the user can see all quarters side by side.
  const [allQuarters, setAllQuarters] = useState(false);

  const [branches, setBranches] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);

  // Mode: period vs period (for the same whole business).
  const [main, setMain] = useState<Period>({ type: "year", year: currentYear, quarter: 1 });
  const [compare, setCompare] = useState<Period>({ type: "year", year: currentYear - 1, quarter: 1 });

  // Mode: entity vs entity (branch vs branch, or company vs company) within one period.
  const [entityA, setEntityA] = useState("");
  const [entityB, setEntityB] = useState("");
  const [entityPeriodA, setEntityPeriodA] = useState<Period>({ type: "year", year: currentYear, quarter: 1 });
  const [entityPeriodB, setEntityPeriodB] = useState<Period>({ type: "year", year: currentYear, quarter: 1 });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results for "period vs period" mode.
  const [mainResult, setMainResult] = useState<CompareResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [periodLabels, setPeriodLabels] = useState<{ main: string; compare: string; metric: Metric } | null>(
    null
  );

  // Results for "entity vs entity" mode.
  const [entityResult, setEntityResult] = useState<{
    a: number;
    b: number;
    labelA: string;
    labelB: string;
    periodA: string;
    periodB: string;
    metric: Metric;
  } | null>(null);

  // Quarter-by-quarter breakdowns (used when "Compare all quarters" is enabled).
  const [periodQuarterRows, setPeriodQuarterRows] = useState<{
    rows: QuarterRow[];
    labelA: string;
    labelB: string;
    metric: Metric;
  } | null>(null);
  const [entityQuarterRows, setEntityQuarterRows] = useState<{
    rows: QuarterRow[];
    labelA: string;
    labelB: string;
    metric: Metric;
  } | null>(null);

  useEffect(() => {
    fetch("/api/sales/filters")
      .then((res) => res.json())
      .then((data: { branches: string[]; companies: string[] }) => {
        setBranches(data.branches);
        setCompanies(data.companies);
      });
  }, []);

  // Reset the entity pickers when switching between branch and company comparison modes.
  useEffect(() => {
    setEntityA("");
    setEntityB("");
    setEntityResult(null);
    setEntityQuarterRows(null);
    setMainResult(null);
    setCompareResult(null);
    setPeriodLabels(null);
    setPeriodQuarterRows(null);
    setError(null);
  }, [mode]);

  async function fetchTotal(
    range: { from: string; to: string },
    extra: { branch?: string; company?: string }
  ): Promise<CompareResult> {
    const params = new URLSearchParams({ from: range.from, to: range.to, metric });
    if (extra.branch) params.set("branch", extra.branch);
    if (extra.company) params.set("company", extra.company);
    const res = await fetch(`/api/sales/compare?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to load comparison data");
    return (await res.json()) as CompareResult;
  }

  const QUARTERS = [1, 2, 3, 4] as const;

  async function runPeriodCompare() {
    setLoading(true);
    setError(null);
    try {
      if (allQuarters) {
        const rows = await Promise.all(
          QUARTERS.map(async (q) => {
            const [a, b] = await Promise.all([
              fetchTotal(periodToRange({ type: "quarter", year: main.year, quarter: q }), {}),
              fetchTotal(periodToRange({ type: "quarter", year: compare.year, quarter: q }), {}),
            ]);
            return { label: `Q${q}`, a: a.overall, b: b.overall };
          })
        );
        setPeriodQuarterRows({ rows, labelA: `${main.year}`, labelB: `${compare.year}`, metric });
        setMainResult(null);
        setCompareResult(null);
        setPeriodLabels(null);
      } else {
        const [a, b] = await Promise.all([
          fetchTotal(periodToRange(main), {}),
          fetchTotal(periodToRange(compare), {}),
        ]);
        setMainResult(a);
        setCompareResult(b);
        setPeriodLabels({ main: periodLabel(main), compare: periodLabel(compare), metric });
        setPeriodQuarterRows(null);
      }
    } catch {
      setError("Could not load comparison data. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function runEntityCompare() {
    if (!entityA || !entityB) {
      setError(`Pick both ${mode === "branch" ? "branches" : "companies"} to compare.`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const key = mode === "branch" ? "branch" : "company";

      if (allQuarters) {
        const rows = await Promise.all(
          QUARTERS.map(async (q) => {
            const [a, b] = await Promise.all([
              fetchTotal(periodToRange({ type: "quarter", year: entityPeriodA.year, quarter: q }), {
                [key]: entityA,
              }),
              fetchTotal(periodToRange({ type: "quarter", year: entityPeriodB.year, quarter: q }), {
                [key]: entityB,
              }),
            ]);
            return { label: `Q${q}`, a: a.overall, b: b.overall };
          })
        );
        setEntityQuarterRows({ rows, labelA: entityA, labelB: entityB, metric });
        setEntityResult(null);
      } else {
        const [a, b] = await Promise.all([
          fetchTotal(periodToRange(entityPeriodA), { [key]: entityA }),
          fetchTotal(periodToRange(entityPeriodB), { [key]: entityB }),
        ]);
        setEntityResult({
          a: a.overall,
          b: b.overall,
          labelA: entityA,
          labelB: entityB,
          periodA: periodLabel(entityPeriodA),
          periodB: periodLabel(entityPeriodB),
          metric,
        });
        setEntityQuarterRows(null);
      }
    } catch {
      setError("Could not load comparison data. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Union of branches across both periods, each paired with its main/compare totals.
  const branchRows = (() => {
    if (!mainResult || !compareResult) return [];
    const compareTotals = new Map(compareResult.branches.map((b) => [b.branch, b.total]));
    const seen = new Set<string>();
    const rows: { branch: string; main: number; compare: number }[] = [];

    for (const row of mainResult.branches) {
      seen.add(row.branch);
      rows.push({ branch: row.branch, main: row.total, compare: compareTotals.get(row.branch) ?? 0 });
    }
    for (const row of compareResult.branches) {
      if (!seen.has(row.branch)) {
        rows.push({ branch: row.branch, main: 0, compare: row.total });
      }
    }
    return rows.sort((a, b) => b.main - a.main);
  })();

  const metricLabel = metric === "value" ? "Sales value" : "Units sold";
  const entityOptions = mode === "branch" ? branches : companies;
  const entityNoun = mode === "branch" ? "branch" : "company";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Compare</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare sales across two periods, two branches, or two companies — by year or by quarter.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">What to compare</label>
          <select
            className={fieldClass}
            value={mode}
            onChange={(e) => setMode(e.target.value as CompareMode)}
          >
            {(Object.keys(MODE_LABELS) as CompareMode[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Metric</label>
          <select
            className={fieldClass}
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
          >
            <option value="units">Units sold</option>
            <option value="value">Sales value (revenue)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Breakdown</span>
          <label className="flex h-8 items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <input
              type="checkbox"
              checked={allQuarters}
              onChange={(e) => setAllQuarters(e.target.checked)}
            />
            Compare all quarters (Q1–Q4)
          </label>
          {allQuarters && (
            <span className="text-xs text-muted-foreground">
              Only the selected year on each side is used — each quarter is shown side by side.
            </span>
          )}
        </div>
      </div>

      {mode === "period" ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <PeriodPicker label="Main period" period={main} onChange={setMain} />
            <PeriodPicker label="Compare against" period={compare} onChange={setCompare} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={runPeriodCompare} disabled={loading}>
              {loading ? "Comparing…" : "Compare"}
            </Button>
            {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
          </div>

          {periodQuarterRows && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {periodQuarterRows.metric === "value" ? "Sales value" : "Units sold"} by quarter —{" "}
                {periodQuarterRows.labelA} vs {periodQuarterRows.labelB}
              </h2>
              <QuarterBreakdownTable {...periodQuarterRows} />
            </div>
          )}

          {periodLabels && mainResult && compareResult && (
            <>
              <div className="rounded-lg border border-border p-4">
                <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Overall {periodLabels.metric === "value" ? "sales value" : "units sold"} —{" "}
                  {periodLabels.main} vs {periodLabels.compare}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground">{periodLabels.main}</p>
                    <p className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                      {formatTotal(mainResult.overall, periodLabels.metric)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{periodLabels.compare}</p>
                    <p className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                      {formatTotal(compareResult.overall, periodLabels.metric)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Change</p>
                    <p className="text-xl">
                      <ChangeIndicator current={mainResult.overall} previous={compareResult.overall} />
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Per-branch {metricLabel.toLowerCase()} — {periodLabels.main} vs {periodLabels.compare}
                </h2>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-card/50 text-left">
                        <th className="px-3 py-2 font-medium">Branch</th>
                        <th className="px-3 py-2 text-right font-medium">{periodLabels.main}</th>
                        <th className="px-3 py-2 text-right font-medium">{periodLabels.compare}</th>
                        <th className="px-3 py-2 text-right font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branchRows.map((row) => (
                        <tr key={row.branch} className="border-b border-border last:border-0">
                          <td className="px-3 py-2">{row.branch}</td>
                          <td className="px-3 py-2 text-right">{formatTotal(row.main, periodLabels.metric)}</td>
                          <td className="px-3 py-2 text-right">
                            {formatTotal(row.compare, periodLabels.metric)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <ChangeIndicator current={row.main} previous={row.compare} />
                          </td>
                        </tr>
                      ))}
                      {branchRows.length === 0 && (
                        <tr>
                          <td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>
                            No data for either period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  {entityNoun === "branch" ? "Branch" : "Company"} A
                </label>
                <select className={fieldClass} value={entityA} onChange={(e) => setEntityA(e.target.value)}>
                  <option value="">Select {entityNoun}…</option>
                  {entityOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <PeriodPicker label="Period for A" period={entityPeriodA} onChange={setEntityPeriodA} />
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  {entityNoun === "branch" ? "Branch" : "Company"} B
                </label>
                <select className={fieldClass} value={entityB} onChange={(e) => setEntityB(e.target.value)}>
                  <option value="">Select {entityNoun}…</option>
                  {entityOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <PeriodPicker label="Period for B" period={entityPeriodB} onChange={setEntityPeriodB} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={runEntityCompare} disabled={loading}>
              {loading ? "Comparing…" : "Compare"}
            </Button>
            {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
          </div>

          {entityQuarterRows && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {entityQuarterRows.metric === "value" ? "Sales value" : "Units sold"} by quarter —{" "}
                {entityQuarterRows.labelA} ({entityPeriodA.year}) vs {entityQuarterRows.labelB} (
                {entityPeriodB.year})
              </h2>
              <QuarterBreakdownTable {...entityQuarterRows} />
            </div>
          )}

          {entityResult && (
            <div className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {entityResult.metric === "value" ? "Sales value" : "Units sold"} comparison
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {entityResult.labelA} — {entityResult.periodA}
                  </p>
                  <p className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                    {formatTotal(entityResult.a, entityResult.metric)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {entityResult.labelB} — {entityResult.periodB}
                  </p>
                  <p className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                    {formatTotal(entityResult.b, entityResult.metric)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {entityResult.labelA} vs {entityResult.labelB}
                  </p>
                  <p className="text-xl">
                    <ChangeIndicator current={entityResult.a} previous={entityResult.b} />
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
