/**
 * The 80-column bill renderer, checked the way the LX-310 will check it: no
 * line may exceed 80 characters, the columns must land where the header
 * says, and the ESC/P stream must be printable bytes only.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderBillLines,
  billToEscp,
  billToHtml,
  qtyText,
  comCode,
  paginate,
  COLS,
  FORM,
} from "../src/modules/sale/billText";
import type { Sale, InvoiceProfile } from "../src/modules/sale/types";

const profile: InvoiceProfile = {
  company: {
    legalName: "Ashok Medical",
    addressLine1: "Main Market Road, Cheeta Camp",
    addressLine2: "Trombay",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400088",
    phone: "8652586786",
    email: "",
    drugLicenseNo: "20/MH-MZ3-440352",
    drugLicenseNo2: "21/MH-MZ3-440353",
    gstin: "27BNTPK2259R1Z9",
    jurisdiction: "Mumbai",
    pharmacistName: "R. Khan",
    mobile: "8652586786",
  },
  tax: { defaultRatePct: 12, invoicePrefix: "SM", priceIncludesTax: true },
  print: {
    documentType: "bill_of_supply",
    layout: "text80",
    copies: "single",
    guideOnBill: false,
  },
  currency: "INR",
};

const sale: Sale = {
  id: "s1",
  invoiceNo: "SM-T1-0272",
  customerId: null,
  customerName: "Mehboob Bee",
  customerMobile: "9000000000",
  customerGstin: "",
  customerAddress: "Chembur",
  doctorName: "uday nayak",
  saleDate: "2026-07-15T14:32:00+05:30",
  taxType: "intra",
  priceIncludesTax: true,
  status: "completed",
  paymentMode: "cash",
  notes: "",
  lines: [
    {
      id: "l1",
      productId: "p1",
      productName: "Omnident Gel 70gm",
      sku: "OM-70",
      hsnCode: "3004",
      mrp: 156,
      manufacturerName: "Group Pharmaceuticals",
      brandName: "",
      baseUnit: "g",
      unit: "tube",
      quantity: 1,
      baseQuantity: 70,
      unitPrice: 156,
      grossAmount: 156,
      discountAmount: 0,
      taxableAmount: 139.29,
      taxRatePct: 12,
      cgst: 8.36,
      sgst: 8.35,
      igst: 0,
      taxAmount: 16.71,
      lineTotal: 156,
      returnedBaseQty: 0,
      allocations: [
        {
          batchId: "b1",
          batchNumber: "OM25118",
          locationId: "L1",
          locationCode: "WH1",
          expiryDate: "2027-10-31",
          baseQty: 70,
          returnedQty: 0,
        },
      ],
    },
    {
      id: "l2",
      productId: "p2",
      productName:
        "A Very Long Medicine Name That Will Certainly Not Fit In Thirty Characters",
      sku: "X",
      hsnCode: "3004",
      mrp: 2317.01,
      manufacturerName: "Sun Pharma",
      brandName: "",
      baseUnit: "tablet",
      unit: "strip",
      quantity: 2,
      baseQuantity: 20,
      unitPrice: 985.5,
      grossAmount: 1971,
      discountAmount: 0,
      taxableAmount: 1759.82,
      taxRatePct: 12,
      cgst: 105.59,
      sgst: 105.59,
      igst: 0,
      taxAmount: 211.18,
      lineTotal: 1971,
      returnedBaseQty: 0,
      allocations: [
        {
          batchId: "b2",
          batchNumber: "AB12345678901",
          locationId: "L1",
          locationCode: "WH1",
          expiryDate: "2028-02-28",
          baseQty: 10,
          returnedQty: 0,
        },
        {
          batchId: "b3",
          batchNumber: "CD999",
          locationId: "L1",
          locationCode: "WH1",
          expiryDate: "2028-05-31",
          baseQty: 10,
          returnedQty: 0,
        },
      ],
    },
  ],
  subtotal: 2127,
  totalDiscount: 0,
  totalTaxable: 1899.11,
  totalCgst: 113.95,
  totalSgst: 113.94,
  totalIgst: 0,
  totalTax: 227.89,
  roundOff: 0,
  grandTotal: 2127,
  totalReturned: 0,
  createdByName: "Cashier",
  createdAt: "2026-07-15T14:32:00+05:30",
};

test("every line fits the LX-310's 80 columns, on both document types", () => {
  for (const docType of ["bill_of_supply", "tax_invoice"] as const) {
    const lines = renderBillLines(sale, {
      ...profile,
      print: { ...profile.print!, documentType: docType },
    });
    for (const l of lines) {
      assert.ok(
        l.text.length <= COLS,
        `${docType}: ${l.text.length} cols: "${l.text}"`,
      );
    }
  }
});

test("the Bill of Supply carries the sample's fields", () => {
  const text = renderBillLines(sale, profile)
    .map((l) => l.text)
    .join("\n");
  assert.match(text, /ASHOK MEDICAL/);
  assert.match(text, /BILL OF SUPPLY/);
  assert.match(text, /Date : 15-07-2026 {2,}Scheduled Bill No\.: SM-T1-0272/);
  assert.match(text, /Name : MEHBOOB BEE/);
  assert.match(text, /Addr : CHEMBUR/);
  assert.match(text, /Doct : uday nayak/);
  // Header carries no phone/GSTIN on the client's bill; they sit in the footer.
  assert.doesNotMatch(text.split("BILL OF SUPPLY")[0], /Ph:|GSTIN/);
  assert.match(
    text,
    /1x70 G\s+OMNIDENT GEL 70GM\s+GRO\s+OM25118\s+10-27\s+156\.00/,
  );
  // Second lot of a split line prints under the first, in the Batch column.
  const rows = renderBillLines(sale, profile).map((l) => l.text);
  const first = rows.find((r) => r.includes("AB12345678"))!;
  const second = rows.find((r) => r.includes("CD999"))!;
  assert.equal(
    second.indexOf("CD999"),
    first.indexOf("AB12345678"),
    "continuation aligns with the Batch column",
  );
  // MRP Val = 156 + 2×2317.01 = 4790.02; Less = MRP Val − Net.
  assert.match(
    text,
    /MRP Val : 4790\.02\s+Less : 2663\.02\s+Net Amount: 2127\.00/,
  );
  assert.match(
    text,
    /E & O\.E\. Subject to MUMBAI jurisdiction\s+For ASHOK MEDICAL/,
  );
  assert.match(text, /Drug Lic\. No\. 20\/MH-MZ3-440352,21\/MH-MZ3-440353/);
  assert.match(text, /GSTIN : 27BNTPK2259R1Z9/);
  assert.match(text, /MOBILE NO\.-8652586786\s+R\. Khan, Pharmacist/);
  // A Bill of Supply must not show tax — the whole reason it exists.
  assert.doesNotMatch(text, /CGST|SGST|IGST|Taxable/);
});

test("the Tax Invoice shows the GST split and no composition line", () => {
  const text = renderBillLines(sale, {
    ...profile,
    print: { ...profile.print!, documentType: "tax_invoice" },
  })
    .map((l) => l.text)
    .join("\n");
  assert.match(text, /TAX INVOICE/);
  assert.match(text, /CGST: 113\.95\s+SGST: 113\.94/);
  assert.match(text, /Net Amount: 2127\.00/);
  assert.doesNotMatch(text, /Composition taxable person/);
  assert.match(text, /HSN/);
});

test("qty and Com follow the sample: packs×size in the base unit, first three letters of the maker", () => {
  assert.equal(qtyText(sale.lines[0]), "1x70 G");
  assert.equal(qtyText(sale.lines[1]), "2x10 TAB");
  assert.equal(
    qtyText({ ...sale.lines[0], quantity: 3, baseQuantity: 3, unit: "tube" }),
    "3 TUBE",
  );
  assert.equal(comCode(sale.lines[0]), "GRO");
  assert.equal(
    comCode({ ...sale.lines[0], manufacturerName: "", brandName: "Cipla Ltd" }),
    "CIP",
  );
});

test("duplicate mode labels each copy and the ESC/P stream is printer-safe", () => {
  const copies = [
    renderBillLines(sale, profile, { copyLabel: "CUSTOMER COPY" }),
    renderBillLines(sale, profile, { copyLabel: "PHARMACY COPY" }),
  ];
  assert.match(copies[0].map((l) => l.text).join("\n"), /\[CUSTOMER COPY\]/);
  assert.match(copies[1].map((l) => l.text).join("\n"), /\[PHARMACY COPY\]/);
  for (const c of copies) for (const l of c) assert.ok(l.text.length <= COLS);

  const escp = billToEscp(copies);
  assert.ok(
    escp.startsWith("\x1b@\x1bP\x1b2"),
    "reset, 10 cpi, 1/6 in spacing",
  );
  assert.ok(escp.includes("\x1bC\x00\x0b"), "form length set to 11 inches");
  assert.ok(escp.includes("\x1bN\x03"), "skip-over-perforation armed");
  assert.equal((escp.match(/\f/g) || []).length, 2, "one form feed per copy");
  // Bold brackets balance.
  assert.equal(
    (escp.match(/\x1bE/g) || []).length,
    (escp.match(/\x1bF/g) || []).length,
  );
  // Printable ASCII plus the control codes we emit: ESC, CR, LF, FF, and the
  // NUL / small-integer parameters of ESC C (form length) and ESC N.
  for (const ch of escp) {
    const c = ch.charCodeAt(0);
    assert.ok(
      c === 0x1b || c <= 0x0f || (c >= 0x20 && c <= 0x7e),
      `bad byte ${c}`,
    );
  }

  const html = billToHtml(copies);
  assert.match(html, /page-break-after: always/);
  assert.equal((html.match(/<pre class="bill">/g) || []).length, 2);
});

test("a long bill breaks at the form, never across the perforation", () => {
  const big: Sale = {
    ...sale,
    lines: Array.from({ length: 70 }, (_, i) => ({
      ...sale.lines[0],
      id: `l${i}`,
      productName: `Item ${i}`,
    })),
  };
  const lines = renderBillLines(big, profile);
  assert.ok(lines.length > FORM.printableLines);
  const pages = paginate(lines);
  assert.ok(pages.length >= 2);
  for (const p of pages)
    assert.ok(p.length <= FORM.printableLines, `page of ${p.length} lines`);
  assert.equal(pages[1][0].text, "(continued)");
  // One FF per form, for a single copy.
  assert.equal((billToEscp([lines]).match(/\f/g) || []).length, pages.length);
  // The HTML route declares the real stationery.
  assert.match(billToHtml([lines]), /@page \{ size: 9\.5in 11in/);
});

test("guide lines print under their item when supplied", () => {
  const text = renderBillLines(sale, profile, {
    guideByProduct: { p1: "Apply thin layer 2-3 times daily." },
  })
    .map((l) => l.text)
    .join("\n");
  assert.match(
    text,
    /OMNIDENT GEL 70GM[\s\S]*Use: Apply thin layer 2-3 times daily\./,
  );
});
