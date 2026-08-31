import { Sale, InvoiceProfile } from "@modules/sale/types";
import { printHtml, printRaw } from "@shared/print";
import { fmtMoneyExact, fmtDateTime } from "@shared/format";
import {
  renderBillLines,
  billToEscp,
  billToHtml,
  qtyText,
  comCode,
  BillLine,
  FORM,
} from "@modules/sale/billText";

/** Every figure on a tax invoice carries its paisa: ₹64.50, not ₹64.5. */
const money = fmtMoneyExact;
const esc = (s: string) =>
  String(s || "").replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!,
  );
const expMMYY = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getFullYear()).slice(-2)}`;
};
const ddmmyyyy = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

/**
 * The A4 Bill of Supply — the client's counter format on a page printer:
 * no tax anywhere, MRP Val / Less / Net, both licences, jurisdiction, GSTIN
 * in the footer, "For <shop>" over the pharmacist's signature.
 */
function billOfSupplyHtml(sale: Sale, profile?: InvoiceProfile): string {
  const c = profile?.company;
  const shop = (c?.legalName || "").toUpperCase();
  let mrpVal = 0;
  const rows = sale.lines
    .map((l) => {
      mrpVal += (Number(l.mrp) || 0) * (Number(l.quantity) || 0);
      const a = l.allocations?.[0];
      const more = (l.allocations || [])
        .slice(1)
        .map(
          (x) =>
            `<div class="muted">${esc(x.batchNumber)} · ${expMMYY(x.expiryDate)}</div>`,
        )
        .join("");
      return `
    <tr>
      <td>${esc(qtyText(l))}</td>
      <td>${esc(l.productName.toUpperCase())}</td>
      <td>${esc(comCode(l))}</td>
      <td>${esc(a?.batchNumber || "")}${more}</td>
      <td>${expMMYY(a?.expiryDate)}</td>
      <td class="r">${money(l.lineTotal)}</td>
    </tr>`;
    })
    .join("");
  const less = Math.max(0, mrpVal - sale.grandTotal);
  const lic = [c?.drugLicenseNo, c?.drugLicenseNo2].filter(Boolean).join(",");
  const addr = [c?.addressLine1, c?.addressLine2, c?.city]
    .filter(Boolean)
    .join(", ")
    .toUpperCase();

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    * { font-family: "Courier New", Courier, monospace; color: #000; }
    body { padding: 24px 28px; font-size: 12px; }
    .c { text-align:center; }
    h1 { font-size: 16px; margin: 0; }
    .title { font-weight:700; font-size: 14px; margin: 6px 0; }
    .grid { display:flex; justify-content:space-between; margin: 6px 0; }
    table { width:100%; border-collapse:collapse; margin-top:6px; }
    th, td { padding:4px 6px; text-align:left; vertical-align:top; }
    th { border-top:1px dashed #000; border-bottom:1px dashed #000; font-weight:700; }
    tbody tr:last-child td { border-bottom:1px dashed #000; }
    .r { text-align:right; }
    .muted { font-size:10px; }
    .totals { display:flex; justify-content:space-between; font-weight:700; margin:8px 0; padding-bottom:6px; border-bottom:1px dashed #000; }
    .foot { display:flex; justify-content:space-between; margin-top:8px; }
    .sign { text-align:right; }
    .sign img { max-height:56px; max-width:200px; object-fit:contain; display:block; margin-left:auto; }
    .signline { width:180px; height:36px; margin-left:auto; }
  </style></head><body>
    <h1 class="c">${esc(shop)}</h1>
    <div class="c">${esc(addr)}${c?.pincode ? "-" + esc(c.pincode) : ""}</div>
    <div class="c title">BILL OF SUPPLY</div>
    <div class="grid"><span>Date : ${ddmmyyyy(sale.saleDate)}</span><span>Scheduled Bill No.: ${esc(sale.invoiceNo)}</span></div>
    <div class="grid"><span>Name : ${esc((sale.customerName || "Walk-in").toUpperCase())}</span><span>${sale.customerAddress ? "Addr : " + esc(sale.customerAddress.toUpperCase()) : ""}</span></div>
    ${sale.doctorName ? `<div>Doct : ${esc(sale.doctorName)}</div>` : ""}
    <table>
      <thead><tr><th>Qty</th><th>Description</th><th>Com</th><th>Batch</th><th>Exp</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals"><span>MRP Val : ${money(mrpVal)}</span><span>Less : ${money(less)}</span><span>Net Amount: ${money(sale.grandTotal)}</span></div>
    <div class="foot">
      <div>
        <div>E &amp; O.E. ${c?.jurisdiction ? "Subject to " + esc(c.jurisdiction.toUpperCase()) + " jurisdiction" : ""}</div>
        ${lic ? `<div>Drug Lic. No. ${esc(lic)}</div>` : ""}
        ${c?.gstin ? `<div>GSTIN : ${esc(c.gstin)}</div>` : ""}
        <div>MOBILE NO.-${esc(c?.mobile || c?.phone || "")}</div>
      </div>
      <div class="sign">
        <div>For ${esc(shop)}</div>
        ${c?.signatureImage ? `<img src="${esc(c.signatureImage)}" alt="" />` : `<div class="signline"></div>`}
        <div>${c?.pharmacistName ? esc(c.pharmacistName) + ", " : ""}Pharmacist</div>
      </div>
    </div>
  </body></html>`;
}

/** Builds the A4 HTML for printing — Tax Invoice or Bill of Supply per settings. */
export function invoiceHtml(sale: Sale, profile?: InvoiceProfile): string {
  if ((profile?.print?.documentType || "bill_of_supply") === "bill_of_supply") {
    return billOfSupplyHtml(sale, profile);
  }
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
  // Driver route: carry the 9.5 × 11 in form on the print job itself, so the
  // desktop shell prints it silently at exact size and a browser's dialog
  // starts from the right page.
  await printHtml(billToHtml(copies), {
    widthMm: FORM.widthIn * 25.4,
    heightMm: FORM.heightIn * 25.4,
  });
}
