export interface DashboardSummary {
  team: { total: number; active: number };
  products: { total: number };
  inventory: { lowStock: number; stockValue: number };
  expiry: { expiringSoon: number; expired: number };
  sales: {
    todayCount: number;
    todayAmount: number;
    yesterdayAmount?: number;
    /** Today vs yesterday change %, null when yesterday was zero. */
    todayTrendPct?: number | null;
  };
  stockInward: { todayCount: number };
}

export interface DashboardFinance {
  receivables: {
    total: number;
    top: { customerId: string; customerName: string; outstanding: number }[];
  };
  needToPay: {
    total: number;
    top: { supplierId: string; supplierName: string; outstanding: number }[];
  };
  upcomingPDC: {
    payable: { total: number; count: number };
    receivable: { total: number; count: number };
    cheques: {
      _id: string;
      direction: "issued" | "received";
      partyName: string;
      amount: number;
      chequeDate: string;
      status: string;
    }[];
  };
  stock: { cost: number; mrp: number; retail: number; units: number };
  sales: {
    last7: number;
    last7Count: number;
    prev7?: number;
    /** Last 7 days vs the 7 before, change %, null when no baseline. */
    trend7Pct?: number | null;
    last30: number;
    last30Count: number;
    /**
     * Gross sales per day for the last 30 days, oldest first, zero-filled.
     *
     * Optional on purpose: it was added to the dashboard endpoint after the app
     * shipped, so a client running against an older backend simply gets no
     * chart rather than a crash.
     */
    daily?: { date: string; value: number; count: number }[];
  };
  purchases: { last30: number };
  margin: {
    revenue: number;
    cogs: number;
    grossMargin: number;
    marginPct: number;
  };
}
