import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { SalesRecord } from "@/lib/models/SalesRecord";
import { buildSalesMatch } from "@/lib/salesQuery";

export async function GET(req: NextRequest) {
  await connectDB();

  const params = req.nextUrl.searchParams;
  const dir = params.get("dir") === "asc" ? 1 : -1;
  const page = Math.max(1, Number(params.get("page") ?? "1"));
  const limit = Math.min(200, Math.max(1, Number(params.get("limit") ?? "50")));

  const match = buildSalesMatch(req);

  const pipeline: mongoose.PipelineStage[] = [
    { $match: match },
    {
      $group: {
        _id: { branch: "$branch", code: "$code", itemName: "$itemName", company: "$company" },
        totalQuantity: { $sum: "$quantity" },
      },
    },
    { $sort: { totalQuantity: dir } },
    {
      $facet: {
        data: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              branch: "$_id.branch",
              code: "$_id.code",
              itemName: "$_id.itemName",
              company: "$_id.company",
              totalQuantity: 1,
            },
          },
        ],
        total: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await SalesRecord.aggregate(pipeline);
  const total = result?.total?.[0]?.count ?? 0;

  return NextResponse.json({
    data: result?.data ?? [],
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}
