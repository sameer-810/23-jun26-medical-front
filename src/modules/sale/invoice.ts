import { Sale, InvoiceProfile } from "@modules/sale/types";
import { printHtml, printRaw } from "@shared/print";
import { fmtMoneyExact, fmtDateTime } from "@shared/format";
import {
  renderBillLines,
  billToEscp,
  billToHtml,
  BillLine,
} from "@modules/sale/billText";

/** Every figure on a tax invoice carries its paisa: ₹64.50, not ₹64.5. */
const money = fmtMoneyExact;
const esc = (s: string) =>
  String(s || "").replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!,
  );

/** Builds a GST-compliant A4 tax-invoice HTML for printing (SOW §9.1). */
export function invoiceHtml(sale: Sale, profile?: InvoiceProfile): string {
  const c = profile?.company;
  const intra = sale.taxType === "intra";
  const rows = sale.lines
    .map(
      (l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(l.productName)}<div class="muted">${esc(l.sku)}</div></td>
      <td>${esc(l.hsnCode || "-")}</td>
      <td class="r">${l.quantity} ${esc(l.unit)}</td>
      <td class="r">${money(l.unitPrice)}</td>
      <td class="r">${l.discountAmount ? money(l.discountAmount) : "-"}</td>
      <td class="r">${l.taxRatePct}%</td>
      <td class="r">${money(l.lineTotal)}</td>
    </tr>`,
    )
    .join("");

  const taxRows = intra
    ? `<tr><td>CGST</td><td class="r">${money(sale.totalCgst)}</td></tr>
       <tr><td>SGST</td><td class="r">${money(sale.totalSgst)}</td></tr>`
    : `<tr><td>IGST</td><td class="r">${money(sale.totalIgst)}</td></tr>`;

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    * { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #0F172A; }
    body { padding: 28px; font-size: 12px; }
    h1 { font-size: 20px; margin: 0; color: #10A058; }
    .muted { color: #64748B; font-size: 10px; }
    .head { display:flex; justify-content:space-between; border-bottom:2px solid #10A058; padding-bottom:12px; margin-bottom:16px; }
    .inv { text-align:right; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    th, td { padding:7px 8px; border-bottom:1px solid #E2E8F0; text-align:left; }
    th { background:#F1F5F9; font-size:10px; text-transform:uppercase; letter-spacing:.04em; }
    .r { text-align:right; }
    .totals { width:280px; margin-left:auto; margin-top:14px; }
    .totals td { border:none; padding:4px 8px; }
    .grand { font-size:15px; font-weight:700; border-top:2px solid #0F172A; }
    .foot { margin-top:16px; color:#64748B; font-size:10px; }
    /* Signature sits right, the way a shop stamps the bottom of a bill. */
    .sign { margin-top:28px; text-align:right; page-break-inside:avoid; }
    .sign img { max-height:56px; max-width:200px; object-fit:contain; }
    .signline { width:200px; height:40px; margin-left:auto; border-bottom:1px solid #94A3B8; }
    .signcap { margin-top:4px; font-size:11px; font-weight:600; color:#0F172A; }
    .signsub { font-size:10px; color:#64748B; }
  </style></head><body>
    <div class="head">
      <div>
        <h1>${esc(c?.legalName || "Plusveda")}</h1>
        <div class="muted">${esc([c?.addressLine1, c?.city, c?.state, c?.pincode].filter(Boolean).join(", "))}</div>
        <div class="muted">${c?.phone ? "Ph: " + esc(c.phone) : ""} ${c?.gstin ? " · GSTIN: " + esc(c.gstin) : ""}</div>
        <div class="muted">${c?.drugLicenseNo ? "Drug Lic: " + esc(c.drugLicenseNo) : ""}</div>
      </div>
      <div class="inv">
        <div style="font-size:14px;font-weight:700">TAX INVOICE</div>
        <div class="muted">${esc(sale.invoiceNo)}</div>
        <div class="muted">${fmtDateTime(sale.saleDate)}</div>
      </div>
    </div>

    <div>
      <b>Bill to:</b> ${esc(sale.customerName)} ${sale.customerMobile ? " · " + esc(sale.customerMobile) : ""}
      ${sale.customerGstin ? '<div class="muted">GSTIN: ' + esc(sale.customerGstin) + "</div>" : ""}
    </div>

    <table>
      <thead><tr><th>#</th><th>Item</th><th>HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Disc</th><th class="r">GST</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <table class="totals">
      <tr><td>Subtotal</td><td class="r">${money(sale.subtotal)}</td></tr>
      <tr><td>Discount</td><td class="r">- ${money(sale.totalDiscount)}</td></tr>
      <tr><td>Taxable</td><td class="r">${money(sale.totalTaxable)}</td></tr>
      ${taxRows}
      ${sale.roundOff ? `<tr><td>Round off</td><td class="r">${money(sale.roundOff)}</td></tr>` : ""}
      <tr class="grand"><td>Grand Total</td><td class="r">${money(sale.grandTotal)}</td></tr>
    </table>

    <div class="foot">
      Payment: ${esc(sale.paymentMode || "-")} · Served by ${esc(sale.createdByName || "-")}
    </div>

    ${
      /**
       * Signature block. A pharmacy invoice is a document a customer may take
       * to an insurer or bring back with a return, and a line naming the staff
       * member who served them is not what makes it look issued by the shop.
       *
       * When no signature has been uploaded we still print the ruled line and
       * the caption, so the owner can sign the printed copy by hand — an
       * invoice with nowhere to sign is worse than one with a blank space.
       */
      ""
    }
    <div class="sign">
      ${c?.signatureImage ? `<img src="${esc(c.signatureImage)}" alt="" />` : `<div class="signline"></div>`}
      <div class="signcap">${esc(c?.signatureLabel || `For ${c?.legalName || "the pharmacy"}`)}</div>
      <div class="signsub">Authorised signatory</div>
    </div>

    <div class="foot">This is a computer-generated invoice.</div>
  </body></html>`;
}

/**
 * Print a bill the way this pharmacy has configured it.
 *
 *  layout "a4"     → the existing HTML invoice (one page per copy).
 *  layout "text80" → the 80-column text bill: raw ESC/P to the dot-matrix
 *                    printer when this machine has one configured, else the
 *                    same text as a monospace HTML page.
 *  copies          → "duplicate" adds a labelled PHARMACY COPY.
 *
 * `guideByProduct` carries the Medicine Guide's one-line "Use:" per item.
 */
export async function printInvoice(
  sale: Sale,
  profile?: InvoiceProfile,
  guideByProduct?: Record<string, string>,
) {
  const layout = profile?.print?.layout || "a4";
  const duplicate = profile?.print?.copies === "duplicate";

  if (layout !== "text80") {
    const html = invoiceHtml(sale, profile);
    if (!duplicate) {
      await printHtml(html);
      return;
    }
    // Two copies in ONE document — the print pipeline has no copies knob.
    const body = html
      .replace(/^[\s\S]*?<body>/, "")
      .replace(/<\/body>[\s\S]*$/, "");
    const head = html.slice(0, html.indexOf("<body>") + 6);
    await printHtml(
      `${head}${body}<div style="page-break-after:always"></div>${body}</body></html>`,
    );
    return;
  }

  const copies: BillLine[][] = duplicate
    ? [
        renderBillLines(sale, profile, {
          copyLabel: "CUSTOMER COPY",
          guideByProduct,
        }),
        renderBillLines(sale, profile, {
          copyLabel: "PHARMACY COPY",
          guideByProduct,
        }),
      ]
    : [renderBillLines(sale, profile, { guideByProduct })];

  if (await printRaw(billToEscp(copies))) return;
  await printHtml(billToHtml(copies));
}
