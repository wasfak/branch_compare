import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { SalesRecord } from "@/lib/models/SalesRecord";
import { buildSalesMatch } from "@/lib/salesQuery";

export async function GET(req: NextRequest) {
  await connectDB();
  const match = buildSalesMatch(req);

  const pipeline: mongoose.PipelineStage[] = [
    { $match: match },
    {
      $group: {
        _id: "$company",
        totalQuantity: { $sum: "$quantity" },
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $project: { _id: 0, company: "$_id", totalQuantity: 1 } },
  ];

  const data = await SalesRecord.aggregate(pipeline);
  return NextResponse.json({ data });
}
