import * as cheerio from "cheerio";

export interface ParsedSalesRow {
  code: string;
  itemName: string;
  company: string;
  quantity: number;
  revenue: number;
  profit: number;
  branch: string;
  periodStart: Date;
  periodEnd: Date;
}

function toNumber(text: string): number {
  const n = Number(text.replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

const BRANCH_LABEL = "فـــــرع";
const PERIOD_TO_LABEL = "إلـــى";
const PERIOD_FROM_LABEL = "خلال الفترة من";

/** Parses report dates in "YYYY/M/D" format into a Date (UTC midnight). */
function parseReportDate(text: string): Date | null {
  const match = text.trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

/**
 * Returns the text of the nearest preceding non-empty <th> before the
 * <th> whose text matches `label`. The report layout always places the
 * value immediately before its Arabic label in document order.
 */
function valueBeforeLabel($: cheerio.CheerioAPI, label: string): string {
  const headers = $("th").toArray();
  for (let i = 0; i < headers.length; i++) {
    if ($(headers[i]).text().trim() === label) {
      for (let j = i - 1; j >= 0; j--) {
        const text = $(headers[j]).text().trim();
        if (text) return text;
      }
    }
  }
  return "";
}

export function parseSalesHtml(html: string): ParsedSalesRow[] {
  const $ = cheerio.load(html);

  const branch = valueBeforeLabel($, BRANCH_LABEL);
  const periodEnd = parseReportDate(valueBeforeLabel($, PERIOD_TO_LABEL));
  const periodStart = parseReportDate(valueBeforeLabel($, PERIOD_FROM_LABEL));
  if (!periodStart || !periodEnd) return [];

  const rows: ParsedSalesRow[] = [];

  $("tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length !== 7) return;

    const values = cells.toArray().map((td) => $(td).text().trim());
    // Columns (RTL): [0]=code(dup) [1]=profit(مبلغ الربح) [2]=revenue(المبلغ)
    // [3]=quantity(الكمية) [4]=company(المورد الرئيسي) [5]=item(الصنف) [6]=code(كود)
    const [, profitText, revenueText, quantityText, company, itemName, code] = values;
    const cleanedQty = quantityText.replace(/,/g, "");
    // Skip header/total/blank rows: a data row always has a code and a numeric qty.
    if (!code || cleanedQty === "" || Number.isNaN(Number(cleanedQty))) return;
    const quantity = Number(cleanedQty);

    rows.push({
      code,
      itemName,
      company,
      quantity,
      revenue: toNumber(revenueText),
      profit: toNumber(profitText),
      branch,
      periodStart,
      periodEnd,
    });
  });

  return rows;
}
