/**
 * The take-home Medicine Guide slip — the same 80-column text pipeline as
 * the bill (raw to the dot-matrix printer when configured, monospace HTML
 * otherwise), so it comes out of whatever the shop prints bills on.
 */
import { MedicineGuide } from "@modules/product/types";
import { Sale } from "@modules/sale/types";
import { billToEscp, billToHtml, BillLine, COLS } from "@modules/sale/billText";
import { printHtml, printRaw } from "@shared/print";

const wrap = (s: string, w: number): string[] => {
  const out: string[] = [];
  let line = "";
  for (const word of String(s || "").split(/\s+/)) {
    if (!word) continue;
    if ((line + " " + word).trim().length > w) {
      if (line) out.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) out.push(line);
  return out;
};

export function guideSlipLines(
  sale: Sale,
  guides: Record<string, MedicineGuide>,
  shopName: string,
): BillLine[] {
  const out: BillLine[] = [];
  const line = (text: string, bold = false) => out.push({ text, bold });
  const center = (s: string) =>
    " ".repeat(Math.max(0, Math.floor((COLS - s.length) / 2))) + s;
  const field = (label: string, value: string) => {
    if (!value) return;
    const rows = wrap(value, COLS - 14);
    rows.forEach((r, i) =>
      line((i === 0 ? label.padEnd(13) : " ".repeat(13)) + " " + r),
    );
  };

  line(center(shopName.toUpperCase()), true);
  line(center("MEDICINE GUIDE"), true);
  line(center(`Bill ${sale.invoiceNo}`));
  line("-".repeat(COLS));
  for (const l of sale.lines) {
    const g = guides[l.productId];
    if (!g) continue;
    line(l.productName.toUpperCase(), true);
    field("Use:", g.use);
    field("Side effects:", g.sideEffects);
    field("Warnings:", g.warnings);
    field("Storage:", g.storage);
    line("");
  }
  line("-".repeat(COLS));
  line(
    "Take medicines exactly as your doctor advised. Keep away from children.",
  );
  return out;
}

export async function printGuideSlip(
  sale: Sale,
  guides: Record<string, MedicineGuide>,
  shopName: string,
) {
  const lines = guideSlipLines(sale, guides, shopName);
  if (await printRaw(billToEscp([lines]))) return;
  await printHtml(billToHtml([lines]));
}

/** WhatsApp-friendly guide text appended under the bill summary. */
export function guideShareText(
  sale: Sale,
  guides: Record<string, MedicineGuide>,
): string {
  const parts: string[] = [];
  for (const l of sale.lines) {
    const g = guides[l.productId];
    if (!g?.use) continue;
    parts.push(
      `*${l.productName}*\nUse: ${g.use}${g.warnings ? `\n⚠ ${g.warnings}` : ""}`,
    );
  }
  return parts.length ? `\n\n_Medicine guide_\n${parts.join("\n\n")}` : "";
}
