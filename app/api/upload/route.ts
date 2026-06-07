import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { SalesRecord } from "@/lib/models/SalesRecord";
import { parseSalesHtml } from "@/lib/parseSalesHtml";

// Files are sent one at a time as a raw text body (filename in the
// X-File-Name header) rather than multipart/form-data, since this Next.js
// version's proxy rebuffers the request body and corrupts multipart boundaries.
export async function POST(req: NextRequest) {
  const rawFileName = req.headers.get("x-file-name");
  const fileName = rawFileName ? decodeURIComponent(rawFileName) : "upload.html";
  const html = await req.text();

  if (!html.trim()) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  await connectDB();

  const rows = parseSalesHtml(html);

  let replaced = 0;

  if (rows.length > 0) {
    const { branch, periodStart, periodEnd } = rows[0];
    // Replace any existing data for this exact branch + period so re-uploading
    // the same report doesn't double-count, while keeping other periods intact.
    const { deletedCount } = await SalesRecord.deleteMany({ branch, periodStart, periodEnd });
    replaced = deletedCount ?? 0;

    await SalesRecord.insertMany(rows.map((row) => ({ ...row, uploadedAt: new Date() })));
  }

  return NextResponse.json({
    file: fileName,
    branch: rows[0]?.branch ?? "",
    rows: rows.length,
    replaced,
  });
}
