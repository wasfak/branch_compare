import type { NextRequest } from "next/server";

/**
 * Supplier values that are not real companies and must never affect any
 * analysis (cancelled / generic / notes placeholders).
 */
export const EXCLUDED_COMPANIES = ["حمدي", "لاغى", "(لاغى)", "مورد عام"];

/**
 * Builds the $match stage shared by sales aggregation routes from the
 * request's query params: branch, company, search (item name / code), and a
 * date range that matches reports whose period overlaps [from, to].
 * Junk suppliers in EXCLUDED_COMPANIES are always filtered out.
 */
export function buildSalesMatch(req: NextRequest): Record<string, unknown> {
  const params = req.nextUrl.searchParams;
  const branch = params.get("branch");
  const company = params.get("company");
  const search = params.get("search");
  const from = params.get("from");
  const to = params.get("to");

  const match: Record<string, unknown> = {};
  if (branch) match.branch = branch;
  // A specific company is always a non-excluded one (the dropdown hides the
  // junk values); otherwise drop the junk suppliers from every aggregation.
  match.company = company ? company : { $nin: EXCLUDED_COMPANIES };
  if (from) match.periodEnd = { $gte: new Date(from) };
  if (to) match.periodStart = { $lte: new Date(to) };
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    match["$or"] = [{ itemName: regex }, { code: regex }];
  }
  return match;
}
