import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { SalesRecord } from "@/lib/models/SalesRecord";
import { EXCLUDED_COMPANIES } from "@/lib/salesQuery";

export async function GET() {
  await connectDB();

  const [branches, companies] = await Promise.all([
    SalesRecord.distinct("branch"),
    SalesRecord.distinct("company"),
  ]);

  return NextResponse.json({
    branches: (branches as string[]).sort(),
    companies: (companies as string[])
      .filter((c) => !EXCLUDED_COMPANIES.includes(c))
      .sort(),
  });
}
