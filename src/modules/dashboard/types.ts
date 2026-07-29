export interface DashboardSummary {
  team: { total: number; active: number };
  products: { total: number };
  inventory: { lowStock: number; stockValue: number };
  expiry: { expiringSoon: number; expired: number };
  sales: { todayCount: number; todayAmount: number };
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
    last30: number;
    last30Count: number;
  };
  purchases: { last30: number };
  margin: {
    revenue: number;
    cogs: number;
    grossMargin: number;
    marginPct: number;
  };
}
