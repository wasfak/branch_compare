import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { SalesRecord } from "@/lib/models/SalesRecord";
import { buildSalesMatch } from "@/lib/salesQuery";

// Returns the overall total and a per-branch breakdown for a date range, summed
// by either units sold (quantity) or sales value (revenue).
export async function GET(req: NextRequest) {
  await connectDB();
  const match = buildSalesMatch(req);
  const metric = req.nextUrl.searchParams.get("metric") === "value" ? "$revenue" : "$quantity";

  const pipeline: mongoose.PipelineStage[] = [
    { $match: match },
    {
      $facet: {
        overall: [{ $group: { _id: null, total: { $sum: metric } } }],
        branches: [
          { $group: { _id: "$branch", total: { $sum: metric } } },
          { $sort: { total: -1 } },
          { $project: { _id: 0, branch: "$_id", total: 1 } },
        ],
      },
    },
  ];

  const [result] = await SalesRecord.aggregate(pipeline);
  return NextResponse.json({
    overall: result?.overall?.[0]?.total ?? 0,
    branches: result?.branches ?? [],
  });
}
