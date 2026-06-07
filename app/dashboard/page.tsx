"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";

type SalesRow = {
  branch: string;
  code: string;
  itemName: string;
  company: string;
  totalQuantity: number;
};

type SalesResponse = {
  data: SalesRow[];
  page: number;
  total: number;
  totalPages: number;
};

type BranchTotal = { branch: string; totalQuantity: number };
type CompanyTotal = { company: string; totalQuantity: number };

// Which ranking row is open in the details modal.
type Detail = { type: "branch" | "company"; value: string };

const fieldClass =
  "h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-input dark:bg-input/30";

// Given a from/to date range, returns the immediately preceding range of equal length,
// e.g. 2026-02-01..2026-02-10 -> 2026-01-22..2026-01-31. Used for period-over-period comparison.
function getPreviousRange(from: string, to: string): { prevFrom: string; prevTo: string } | null {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  const lengthDays = Math.round((toDate.getTime() - fromDate.getTime()) / dayMs) + 1;

  const prevTo = new Date(fromDate.getTime() - dayMs);
  const prevFrom = new Date(prevTo.getTime() - (lengthDays - 1) * dayMs);

  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { prevFrom: toIso(prevFrom), prevTo: toIso(prevTo) };
}

// Formats a percentage change as a signed string, e.g. "+12.3%" or "New".
function formatChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "New" : "—";
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
}

// Builds a CSV file from rows of plain values and triggers a browser download.
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DashboardPage() {
  const [branches, setBranches] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);

  const [branch, setBranch] = useState("");
  const [company, setCompany] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<SalesResponse | null>(null);
  const [branchTotals, setBranchTotals] = useState<BranchTotal[] | null>(null);

  // Top-section rankings (respect only the date range, so they stay global).
  const [branchRanking, setBranchRanking] = useState<BranchTotal[] | null>(null);
  const [companyRanking, setCompanyRanking] = useState<CompanyTotal[] | null>(null);

  // Period-over-period comparison: rankings for the equivalent preceding date range.
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [prevBranchRanking, setPrevBranchRanking] = useState<BranchTotal[] | null>(null);
  const [prevCompanyRanking, setPrevCompanyRanking] = useState<CompanyTotal[] | null>(null);

  // Search, sort, and pagination for the company ranking.
  const [companySearch, setCompanySearch] = useState("");
  const [companySort, setCompanySort] = useState<"desc" | "asc">("desc");
  const [companyPage, setCompanyPage] = useState(1);

  // Details modal state.
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailCompanies, setDetailCompanies] = useState<CompanyTotal[] | null>(null);
  const [detailBranches, setDetailBranches] = useState<BranchTotal[] | null>(null);

  // Search, sort, and pagination within the branch-detail company list.
  const [detailSearch, setDetailSearch] = useState("");
  const [detailSort, setDetailSort] = useState<"desc" | "asc">("desc");
  const [detailPage, setDetailPage] = useState(1);

  // Sort for the company-detail branch list.
  const [detailBranchSort, setDetailBranchSort] = useState<"desc" | "asc">("desc");

  const PAGE_SIZE = 20;

  useEffect(() => {
    fetch("/api/sales/filters")
      .then((res) => res.json())
      .then((data: { branches: string[]; companies: string[] }) => {
        setBranches(data.branches);
        setCompanies(data.companies);
      });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (branch) params.set("branch", branch);
    if (company) params.set("company", company);
    if (search) params.set("search", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("sort", "quantity");
    params.set("dir", dir);
    params.set("page", String(page));

    const controller = new AbortController();
    fetch(`/api/sales?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: SalesResponse) => setResult(data))
      .catch(() => {});

    return () => controller.abort();
  }, [branch, company, search, from, to, dir, page]);

  // Ranks branches by total units sold for the selected company (and date range).
  useEffect(() => {
    if (!company) return;

    const params = new URLSearchParams();
    params.set("company", company);
    params.set("sort", "quantity");
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const controller = new AbortController();
    fetch(`/api/sales/by-branch?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: { data: BranchTotal[] }) => setBranchTotals(data.data))
      .catch(() => {});

    return () => controller.abort();
  }, [company, from, to]);

  // Global rankings for the top section (date range only + always-excluded junk).
  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();

    const controller = new AbortController();
    Promise.all([
      fetch(`/api/sales/by-branch?${qs}`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`/api/sales/by-company?${qs}`, { signal: controller.signal }).then((r) => r.json()),
    ])
      .then(([b, c]: [{ data: BranchTotal[] }, { data: CompanyTotal[] }]) => {
        setBranchRanking(b.data);
        setCompanyRanking(c.data);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [from, to]);

  // Comparison rankings for the equivalent preceding period (only when enabled and a range is set).
  useEffect(() => {
    if (!compareEnabled || !from || !to) {
      setPrevBranchRanking(null);
      setPrevCompanyRanking(null);
      return;
    }

    const range = getPreviousRange(from, to);
    if (!range) return;

    const params = new URLSearchParams();
    params.set("from", range.prevFrom);
    params.set("to", range.prevTo);
    const qs = params.toString();

    const controller = new AbortController();
    Promise.all([
      fetch(`/api/sales/by-branch?${qs}`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`/api/sales/by-company?${qs}`, { signal: controller.signal }).then((r) => r.json()),
    ])
      .then(([b, c]: [{ data: BranchTotal[] }, { data: CompanyTotal[] }]) => {
        setPrevBranchRanking(b.data);
        setPrevCompanyRanking(c.data);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [compareEnabled, from, to]);

  // Details for the open modal: a branch shows its top companies; a company shows its branches.
  useEffect(() => {
    if (!detail) return;

    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const controller = new AbortController();

    if (detail.type === "branch") {
      params.set("branch", detail.value);
      fetch(`/api/sales/by-company?${params.toString()}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data: { data: CompanyTotal[] }) => setDetailCompanies(data.data))
        .catch(() => {});
    } else {
      params.set("company", detail.value);
      fetch(`/api/sales/by-branch?${params.toString()}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data: { data: BranchTotal[] }) => setDetailBranches(data.data))
        .catch(() => {});
    }

    return () => controller.abort();
  }, [detail, from, to]);

  function openDetail(next: Detail) {
    setDetailCompanies(null);
    setDetailBranches(null);
    setDetailSearch("");
    setDetailSort("desc");
    setDetailPage(1);
    setDetailBranchSort("desc");
    setDetail(next);
  }

  function resetPage<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  // Lookups from the previous-period rankings, used to compute % change per row.
  const prevBranchTotals = new Map((prevBranchRanking ?? []).map((r) => [r.branch, r.totalQuantity]));
  const prevCompanyTotals = new Map((prevCompanyRanking ?? []).map((r) => [r.company, r.totalQuantity]));
  const showCompare = compareEnabled && !!from && !!to;

  // Derived view of the company ranking: search, sort, percentage of total, and pagination.
  const companyTotalUnits = (companyRanking ?? []).reduce((sum, r) => sum + r.totalQuantity, 0);
  const filteredCompanyRanking = (companyRanking ?? [])
    .filter((row) => row.company.toLowerCase().includes(companySearch.trim().toLowerCase()))
    .sort((a, b) => (companySort === "desc" ? b.totalQuantity - a.totalQuantity : a.totalQuantity - b.totalQuantity));
  const companyPageCount = Math.max(1, Math.ceil(filteredCompanyRanking.length / PAGE_SIZE));
  const pagedCompanyRanking = filteredCompanyRanking.slice(
    (companyPage - 1) * PAGE_SIZE,
    companyPage * PAGE_SIZE
  );

  // Derived view of the branch-detail company list: search, sort, percentage of branch total, and pagination.
  const detailTotalUnits = (detailCompanies ?? []).reduce((sum, r) => sum + r.totalQuantity, 0);
  const filteredDetailCompanies = (detailCompanies ?? [])
    .filter((row) => row.company.toLowerCase().includes(detailSearch.trim().toLowerCase()))
    .sort((a, b) => (detailSort === "desc" ? b.totalQuantity - a.totalQuantity : a.totalQuantity - b.totalQuantity));
  const detailPageCount = Math.max(1, Math.ceil(filteredDetailCompanies.length / PAGE_SIZE));
  const pagedDetailCompanies = filteredDetailCompanies.slice(
    (detailPage - 1) * PAGE_SIZE,
    detailPage * PAGE_SIZE
  );

  // Derived view of the company-detail branch list: sort and percentage of the company's total.
  const detailBranchTotalUnits = (detailBranches ?? []).reduce((sum, r) => sum + r.totalQuantity, 0);
  const sortedDetailBranches = (detailBranches ?? [])
    .slice()
    .sort((a, b) =>
      detailBranchSort === "desc" ? b.totalQuantity - a.totalQuantity : a.totalQuantity - b.totalQuantity
    );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Sales analysis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Filter and sort imported sales records across all branches.
        </p>
      </div>

      {/* Top rankings: total units per branch and per company (click for details) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Top branches by units sold
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "top-branches.csv",
                  ["Branch", "Total units"],
                  (branchRanking ?? []).map((row) => [row.branch, row.totalQuantity])
                )
              }
            >
              Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card/50 text-left">
                  <th className="px-3 py-2 font-medium">Branch</th>
                  <th className="px-3 py-2 text-right font-medium">Total units</th>
                  {showCompare && (
                    <th className="px-3 py-2 text-right font-medium">vs previous period</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {(branchRanking ?? []).map((row) => (
                  <tr
                    key={row.branch}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                    onClick={() => openDetail({ type: "branch", value: row.branch })}
                  >
                    <td className="px-3 py-2">{row.branch}</td>
                    <td className="px-3 py-2 text-right">{row.totalQuantity.toLocaleString()}</td>
                    {showCompare && (
                      <td className="px-3 py-2 text-right">
                        {formatChange(row.totalQuantity, prevBranchTotals.get(row.branch) ?? 0)}
                      </td>
                    )}
                  </tr>
                ))}
                {branchRanking && branchRanking.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={showCompare ? 3 : 2}>
                      No data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Top companies by units sold
            </h2>
            <div className="flex items-center gap-2">
              <input
                className={`${fieldClass} w-48`}
                placeholder="Search company..."
                value={companySearch}
                onChange={(e) => {
                  setCompanySearch(e.target.value);
                  setCompanyPage(1);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(
                    "top-companies.csv",
                    ["Company", "Total units", "% of total"],
                    filteredCompanyRanking.map((row) => [
                      row.company,
                      row.totalQuantity,
                      companyTotalUnits > 0
                        ? `${((row.totalQuantity / companyTotalUnits) * 100).toFixed(1)}%`
                        : "",
                    ])
                  )
                }
              >
                Export CSV
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card/50 text-left">
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th
                    className="cursor-pointer select-none px-3 py-2 text-right font-medium"
                    onClick={() => {
                      setCompanySort((s) => (s === "desc" ? "asc" : "desc"));
                      setCompanyPage(1);
                    }}
                  >
                    Total units {companySort === "desc" ? "▼" : "▲"}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">% of total</th>
                  {showCompare && (
                    <th className="px-3 py-2 text-right font-medium">vs previous period</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pagedCompanyRanking.map((row, index) => (
                  <tr
                    key={row.company}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                    onClick={() => openDetail({ type: "company", value: row.company })}
                  >
                    <td className="px-3 py-2">
                      {(companyPage - 1) * PAGE_SIZE + index + 1}. {row.company}
                    </td>
                    <td className="px-3 py-2 text-right">{row.totalQuantity.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      {companyTotalUnits > 0
                        ? `${((row.totalQuantity / companyTotalUnits) * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    {showCompare && (
                      <td className="px-3 py-2 text-right">
                        {formatChange(row.totalQuantity, prevCompanyTotals.get(row.company) ?? 0)}
                      </td>
                    )}
                  </tr>
                ))}
                {companyRanking && filteredCompanyRanking.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={showCompare ? 4 : 3}>
                      No data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredCompanyRanking.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                Page {companyPage} of {companyPageCount}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={companyPage <= 1}
                  onClick={() => setCompanyPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={companyPage >= companyPageCount}
                  onClick={() => setCompanyPage((p) => Math.min(companyPageCount, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Visual overview: bar charts for the top branches and companies */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Top 10 branches — chart
          </h2>
          <div className="rounded-lg border border-border p-3" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(branchRanking ?? []).slice(0, 10)}
                layout="vertical"
                margin={{ left: 16, right: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="branch"
                  width={120}
                  tick={{ fontSize: 12 }}
                  interval={0}
                />
                <Tooltip formatter={(value) => Number(value).toLocaleString()} />
                <Bar dataKey="totalQuantity" name="Total units" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Top 10 companies — chart
          </h2>
          <div className="rounded-lg border border-border p-3" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(companyRanking ?? []).slice(0, 10)}
                layout="vertical"
                margin={{ left: 16, right: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="company"
                  width={120}
                  tick={{ fontSize: 12 }}
                  interval={0}
                />
                <Tooltip formatter={(value) => Number(value).toLocaleString()} />
                <Bar dataKey="totalQuantity" name="Total units" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Branch</label>
          <select
            className={fieldClass}
            value={branch}
            onChange={(e) => resetPage(setBranch)(e.target.value)}
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Company</label>
          <select
            className={fieldClass}
            value={company}
            onChange={(e) => resetPage(setCompany)(e.target.value)}
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Search item / code</label>
          <input
            className={`${fieldClass} w-56`}
            placeholder="Type to search..."
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From date</label>
          <input
            type="date"
            className={fieldClass}
            value={from}
            onChange={(e) => resetPage(setFrom)(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To date</label>
          <input
            type="date"
            className={fieldClass}
            value={to}
            onChange={(e) => resetPage(setTo)(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Comparison</span>
          <label className="flex h-8 items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={(e) => setCompareEnabled(e.target.checked)}
            />
            Compare to previous period
          </label>
          {compareEnabled && (!from || !to) && (
            <span className="text-xs text-muted-foreground">Pick a from/to date range to compare.</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Sort by units</label>
          <select
            className={fieldClass}
            value={dir}
            onChange={(e) => resetPage(setDir)(e.target.value as "asc" | "desc")}
          >
            <option value="desc">Highest first (best sellers)</option>
            <option value="asc">Lowest first (idle stock)</option>
          </select>
        </div>

        {(branch || company || search || from || to) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              resetPage(setBranch)("");
              resetPage(setCompany)("");
              resetPage(setSearch)("");
              resetPage(setFrom)("");
              resetPage(setTo)("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {company && branchTotals && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Total units sold per branch — {company}
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card/50 text-left">
                  <th className="px-3 py-2 font-medium">Branch</th>
                  <th className="px-3 py-2 text-right font-medium">Total units sold</th>
                </tr>
              </thead>
              <tbody>
                {branchTotals.map((row) => (
                  <tr key={row.branch} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{row.branch}</td>
                    <td className="px-3 py-2 text-right">{row.totalQuantity.toLocaleString()}</td>
                  </tr>
                ))}
                {branchTotals.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={2}>
                      No sales for this company in the selected range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card/50 text-left">
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Branch</th>
              <th className="px-3 py-2 text-right font-medium">Total quantity</th>
            </tr>
          </thead>
          <tbody>
            {result?.data.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{row.code}</td>
                <td className="px-3 py-2">{row.itemName}</td>
                <td className="px-3 py-2">{row.company}</td>
                <td className="px-3 py-2">{row.branch}</td>
                <td className="px-3 py-2 text-right">{row.totalQuantity.toLocaleString()}</td>
              </tr>
            ))}
            {result && result.data.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={5}>
                  No records match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {result && result.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {result.page} of {result.totalPages} · {result.total.toLocaleString()} items
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= result.totalPages}
              onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                {detail.type === "branch"
                  ? `Top companies by units sold — ${detail.value}`
                  : `Branches selling — ${detail.value}`}
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    detail.type === "branch"
                      ? downloadCsv(
                          `${detail.value}-top-companies.csv`,
                          ["Company", "Total units", "% of branch total"],
                          filteredDetailCompanies.map((row) => [
                            row.company,
                            row.totalQuantity,
                            detailTotalUnits > 0
                              ? `${((row.totalQuantity / detailTotalUnits) * 100).toFixed(1)}%`
                              : "",
                          ])
                        )
                      : downloadCsv(
                          `${detail.value}-branches.csv`,
                          ["Branch", "Total units", "% of company total"],
                          sortedDetailBranches.map((row) => [
                            row.branch,
                            row.totalQuantity,
                            detailBranchTotalUnits > 0
                              ? `${((row.totalQuantity / detailBranchTotalUnits) * 100).toFixed(1)}%`
                              : "",
                          ])
                        )
                  }
                >
                  Export CSV
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDetail(null)}>
                  Close
                </Button>
              </div>
            </div>

            {detail.type === "branch" && (
              <div className="mt-3">
                <input
                  className={`${fieldClass} w-48`}
                  placeholder="Search company..."
                  value={detailSearch}
                  onChange={(e) => {
                    setDetailSearch(e.target.value);
                    setDetailPage(1);
                  }}
                />
              </div>
            )}

            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              {detail.type === "branch" ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-card/50 text-left">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Company</th>
                      <th
                        className="cursor-pointer select-none px-3 py-2 text-right font-medium"
                        onClick={() => {
                          setDetailSort((s) => (s === "desc" ? "asc" : "desc"));
                          setDetailPage(1);
                        }}
                      >
                        Total units {detailSort === "desc" ? "▼" : "▲"}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">% of branch total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDetailCompanies.map((row, index) => (
                      <tr key={row.company} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{(detailPage - 1) * PAGE_SIZE + index + 1}</td>
                        <td className="px-3 py-2">{row.company}</td>
                        <td className="px-3 py-2 text-right">{row.totalQuantity.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">
                          {detailTotalUnits > 0
                            ? `${((row.totalQuantity / detailTotalUnits) * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {detailCompanies && filteredDetailCompanies.length === 0 && (
                      <tr>
                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>
                          No companies in the selected range.
                        </td>
                      </tr>
                    )}
                    {!detailCompanies && (
                      <tr>
                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>
                          Loading…
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-card/50 text-left">
                      <th className="px-3 py-2 font-medium">Branch</th>
                      <th
                        className="cursor-pointer select-none px-3 py-2 text-right font-medium"
                        onClick={() => setDetailBranchSort((s) => (s === "desc" ? "asc" : "desc"))}
                      >
                        Total units {detailBranchSort === "desc" ? "▼" : "▲"}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">% of company total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDetailBranches.map((row) => (
                      <tr key={row.branch} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{row.branch}</td>
                        <td className="px-3 py-2 text-right">{row.totalQuantity.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">
                          {detailBranchTotalUnits > 0
                            ? `${((row.totalQuantity / detailBranchTotalUnits) * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {detailBranches && detailBranches.length === 0 && (
                      <tr>
                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={3}>
                          No branches in the selected range.
                        </td>
                      </tr>
                    )}
                    {!detailBranches && (
                      <tr>
                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={3}>
                          Loading…
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {detail.type === "branch" && filteredDetailCompanies.length > PAGE_SIZE && (
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  Page {detailPage} of {detailPageCount}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={detailPage <= 1}
                    onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={detailPage >= detailPageCount}
                    onClick={() => setDetailPage((p) => Math.min(detailPageCount, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
