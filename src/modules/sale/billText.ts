/**
 * 80-column bill renderer for dot-matrix printers (client Feature 1).
 *
 * The client's till is an Epson LX-310 — 9-pin, narrow carriage, tractor-fed
 * continuous stationery, 80 characters per line at 10 cpi. Everything a 9-pin
 * printer does well is plain text: send it characters and it prints a bill
 * in two seconds, crisp. Send it a web page and the driver rasterises a
 * bitmap — a minute a bill, grey and fuzzy. So this module produces LINES OF
 * TEXT, and two thin adapters turn them into ESC/P bytes for the printer or a
 * monospace HTML page for everywhere else.
 *
 * Two legal documents come out of one layout:
 *  - TAX INVOICE      shows the GST split (regular GST dealers)
 *  - BILL OF SUPPLY   shows no tax and carries the composition-dealer line
 * The choice is the pharmacy's `print.documentType` setting — a fact about
 * their GST registration, never a look.
 */
import { Sale, InvoiceProfile } from "@modules/sale/types";

export const COLS = 80;

export interface BillLine {
  text: string;
  bold?: boolean;
}

export interface BillTextOptions {
  /** "CUSTOMER COPY" / "PHARMACY COPY" — printed on the title line. */
  copyLabel?: string;
  /** One short "Use:" line per productId (Medicine Guide on the bill). */
  guideByProduct?: Record<string, string>;
}

// ---- text helpers ----------------------------------------------------------

const money = (n: number) => (Number(n) || 0).toFixed(2);
const pad = (s: string, w: number) =>
  s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
const rpad = (s: string, w: number) =>
  s.length >= w ? s.slice(-w) : " ".repeat(w - s.length) + s;
const center = (s: string, w = COLS) => {
  const t = s.length > w ? s.slice(0, w) : s;
  const left = Math.floor((w - t.length) / 2);
  return " ".repeat(left) + t;
};
const rule = (ch = "-") => ch.repeat(COLS);
/** Two fields on one line: left-aligned and right-aligned halves. */
const twoUp = (left: string, right: string) => {
  const l = left.slice(0, COLS - right.length - 1);
  return l + " ".repeat(Math.max(1, COLS - l.length - right.length)) + right;
};
/** Word-wrap to `w`, at most `max` lines. */
const wrap = (s: string, w: number, max = 2): string[] => {
  const out: string[] = [];
  let line = "";
  for (const word of String(s || "").split(/\s+/)) {
    if (!word) continue;
    if ((line + " " + word).trim().length > w) {
      if (line) out.push(line);
      line = word;
      if (out.length >= max) break;
    } else line = (line + " " + word).trim();
  }
  if (line && out.length < max) out.push(line);
  return out.map((l) => l.slice(0, w));
};

const dd = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${dd(d.getDate())}-${dd(d.getMonth() + 1)}-${d.getFullYear()}`;
};
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `${dd(d.getHours())}:${dd(d.getMinutes())}`;
};
/** "10-27" — expiry as MM-YY, the way every pharmacy bill prints it. */
const fmtExp = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${dd(d.getMonth() + 1)}-${String(d.getFullYear()).slice(-2)}`;
};

/** "1x70 G": packs × base units per pack, in the base unit. */
export function qtyText(l: Sale["lines"][number]): string {
  const factor = l.quantity > 0 ? l.baseQuantity / l.quantity : 1;
  if (factor > 1 && Number.isInteger(factor)) {
    const q = Number.isInteger(l.quantity)
      ? String(l.quantity)
      : l.quantity.toFixed(1);
    return `${q}x${factor}${l.baseUnit ? " " + l.baseUnit.toUpperCase() : ""}`;
  }
  const q = Number.isInteger(l.quantity)
    ? String(l.quantity)
    : String(l.quantity);
  return `${q} ${(l.unit || "").toUpperCase()}`;
}

/** "GRO" — the first three letters of the maker, as the sample bill prints it. */
export function comCode(l: Sale["lines"][number]): string {
  const src = (l.manufacturerName || l.brandName || "").trim();
  return src
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

// ---- the bill --------------------------------------------------------------

export function renderBillLines(
  sale: Sale,
  profile?: InvoiceProfile,
  opts: BillTextOptions = {},
): BillLine[] {
  const c = profile?.company;
  const docType = profile?.print?.documentType || "tax_invoice";
  const isBoS = docType === "bill_of_supply";
  const out: BillLine[] = [];
  const line = (text: string, bold = false) => out.push({ text, bold });

  // Header
  line(center((c?.legalName || "").toUpperCase()), true);
  const addr = [c?.addressLine1, c?.addressLine2, c?.city]
    .filter(Boolean)
    .join(", ")
    .toUpperCase();
  const addrFull = c?.pincode ? `${addr}-${c.pincode}` : addr;
  for (const l of wrap(addrFull, COLS)) line(center(l));
  const contact = [
    c?.phone ? `Ph: ${c.phone}` : "",
    c?.gstin ? `GSTIN: ${c.gstin}` : "",
  ]
    .filter(Boolean)
    .join("   ");
  if (contact) line(center(contact));
  const title = isBoS ? "BILL OF SUPPLY" : "TAX INVOICE";
  line(
    opts.copyLabel
      ? twoUp(center(title).trimEnd(), `[${opts.copyLabel}]`)
      : center(title),
    true,
  );
  line(rule("="));

  // Metadata grid
  line(
    twoUp(
      `Date: ${fmtDate(sale.saleDate)} ${fmtTime(sale.saleDate)}`,
      `Bill No: ${sale.invoiceNo}`,
    ),
  );
  line(
    twoUp(
      `Name: ${(sale.customerName || "Walk-in").toUpperCase()}`,
      sale.customerAddress ? `Addr: ${sale.customerAddress.toUpperCase()}` : "",
    ),
  );
  const doct = sale.doctorName ? `Doct: ${sale.doctorName}` : "";
  const mob = sale.customerMobile ? `Mob: ${sale.customerMobile}` : "";
  if (doct || mob) line(twoUp(doct, mob));
  if (sale.customerGstin) line(`Cust GSTIN: ${sale.customerGstin}`);
  line(rule());

  // Items
  if (isBoS) {
    // Qty(9) Desc(30) Com(5) Batch(11) Exp(7) Amount(10) = 77 with gutters
    line(
      pad("Qty", 9) +
        " " +
        pad("Description", 30) +
        " " +
        pad("Com", 5) +
        " " +
        pad("Batch", 11) +
        " " +
        pad("Exp", 7) +
        " " +
        rpad("Amount", 10),
      true,
    );
  } else {
    // Qty(9) Desc(26) HSN(8) Batch(10) Exp(6) GST%(5) Amount(10) = 80
    line(
      pad("Qty", 9) +
        " " +
        pad("Description", 26) +
        " " +
        pad("HSN", 8) +
        " " +
        pad("Batch", 10) +
        " " +
        pad("Exp", 6) +
        " " +
        rpad("GST%", 5) +
        " " +
        rpad("Amount", 10),
      true,
    );
  }
  line(rule());

  let mrpVal = 0;
  for (const l of sale.lines) {
    const alloc = l.allocations?.[0];
    const batch = alloc?.batchNumber || "";
    const exp = fmtExp(alloc?.expiryDate);
    const desc = (l.productName || "").toUpperCase();
    mrpVal += (Number(l.mrp) || 0) * (Number(l.quantity) || 0);
    if (isBoS) {
      line(
        pad(qtyText(l), 9) +
          " " +
          pad(desc, 30) +
          " " +
          pad(comCode(l), 5) +
          " " +
          pad(batch, 11) +
          " " +
          pad(exp, 7) +
          " " +
          rpad(money(l.lineTotal), 10),
      );
    } else {
      line(
        pad(qtyText(l), 9) +
          " " +
          pad(desc, 26) +
          " " +
          pad(l.hsnCode || "", 8) +
          " " +
          pad(batch, 10) +
          " " +
          pad(exp, 6) +
          " " +
          rpad(`${l.taxRatePct}%`, 5) +
          " " +
          rpad(money(l.lineTotal), 10),
      );
    }
    // Further lots of a multi-batch line, indented under it.
    for (const a of (l.allocations || []).slice(1)) {
      line(
        pad("", isBoS ? 46 : 45) +
          pad(a.batchNumber || "", isBoS ? 11 : 10) +
          " " +
          pad(fmtExp(a.expiryDate), 7),
      );
    }
    const guide = opts.guideByProduct?.[l.productId];
    if (guide)
      for (const g of wrap(`Use: ${guide}`, COLS - 10, 1))
        line(pad("", 10) + g);
  }
  line(rule());

  // Money
  if (isBoS) {
    const less = Math.max(0, mrpVal - sale.grandTotal);
    line(
      twoUp(
        `MRP Val: ${money(mrpVal)}     Less: ${money(less)}`,
        `Net Amount: ${money(sale.grandTotal)}`,
      ),
      true,
    );
  } else {
    const intra = sale.taxType === "intra";
    line(
      twoUp(
        `Taxable: ${money(sale.totalTaxable)}   Disc: ${money(sale.totalDiscount)}`,
        intra
          ? `CGST: ${money(sale.totalCgst)}  SGST: ${money(sale.totalSgst)}`
          : `IGST: ${money(sale.totalIgst)}`,
      ),
    );
    line(
      twoUp(
        sale.roundOff ? `Round off: ${money(sale.roundOff)}` : "",
        `Net Amount: ${money(sale.grandTotal)}`,
      ),
      true,
    );
  }
  line(rule());

  // Footer
  const foot1 = [
    "E & O.E.",
    c?.jurisdiction ? `Subject to ${c.jurisdiction} jurisdiction` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const lic = [c?.drugLicenseNo, c?.drugLicenseNo2].filter(Boolean).join(", ");
  line(twoUp(foot1, lic ? `Drug Lic. No: ${lic}` : ""));
  if (isBoS) {
    line(
      "Composition taxable person, not eligible to collect tax on supplies.",
    );
  }
  line(
    twoUp(
      `MOBILE NO: ${c?.mobile || c?.phone || ""}`,
      `Pharmacist Signature: ________________`,
    ),
  );
  if (c?.pharmacistName) line(rpad(c.pharmacistName, COLS));
  if (sale.paymentMode) line(`Paid by: ${sale.paymentMode.toUpperCase()}`);
  return out;
}

// ---- adapters --------------------------------------------------------------

/**
 * ESC/P byte stream, as a Latin-1 string (every char < 256). ESC @ resets the
 * printer, ESC P selects 10 cpi, ESC E / ESC F bracket bold, FF ejects the
 * page so the tear-off lands on the perforation.
 */
export function billToEscp(copies: BillLine[][]): string {
  const ESC = "\x1b";
  let s = `${ESC}@${ESC}P`;
  for (const lines of copies) {
    for (const l of lines) {
      const text = l.text.replace(/[^\x20-\x7e]/g, "?");
      s += l.bold ? `${ESC}E${text}${ESC}F` : text;
      s += "\r\n";
    }
    s += "\f";
  }
  return s;
}

/** Monospace HTML for browsers, phones, and any non-dot-matrix printer. */
export function billToHtml(copies: BillLine[][]): string {
  const esc = (t: string) =>
    t.replace(
      /[&<>]/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!,
    );
  const pages = copies
    .map(
      (lines) =>
        `<pre class="bill">` +
        lines
          .map((l) => (l.bold ? `<b>${esc(l.text)}</b>` : esc(l.text)))
          .join("\n") +
        `</pre>`,
    )
    .join(`<div class="cut"></div>`);
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page { margin: 8mm; }
    body { margin: 0; }
    .bill { font: 11.5px/1.3 "Courier New", Courier, monospace; white-space: pre; margin: 0; color: #000; }
    .cut { page-break-after: always; }
  </style></head><body>${pages}</body></html>`;
}
