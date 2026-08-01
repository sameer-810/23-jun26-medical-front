import { Sale, InvoiceProfile } from "@modules/sale/types";
import { printHtml } from "@shared/print";

const money = (n: number) =>
  `₹${(Math.round(n * 100) / 100).toLocaleString("en-IN")}`;
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
    .foot { margin-top:30px; color:#64748B; font-size:10px; }
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
        <div class="muted">${new Date(sale.saleDate).toLocaleString()}</div>
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
      Payment: ${esc(sale.paymentMode || "-")} · Served by ${esc(sale.createdByName || "-")}<br/>
      This is a computer-generated invoice.
    </div>
  </body></html>`;
}

export async function printInvoice(sale: Sale, profile?: InvoiceProfile) {
  await printHtml(invoiceHtml(sale, profile));
}
