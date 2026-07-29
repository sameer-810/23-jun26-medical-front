export type ChequeDirection = "issued" | "received";
export type ChequeStatus = "pending" | "cleared" | "bounced" | "cancelled";

export interface Cheque {
  _id: string;
  direction: ChequeDirection;
  partyType: "supplier" | "customer" | "";
  partyId: string | null;
  partyName: string;
  chequeNo: string;
  bankName: string;
  amount: number;
  chequeDate: string;
  status: ChequeStatus;
  clearedAt: string | null;
  note: string;
  createdByName: string;
  createdAt: string;
}

export interface ChequePayload {
  direction: ChequeDirection;
  partyType?: "supplier" | "customer";
  partyId?: string | null;
  partyName?: string;
  chequeNo?: string;
  bankName?: string;
  amount: number;
  chequeDate: string;
  note?: string;
}

export interface UpcomingPdc {
  days: number;
  payable: { total: number; count: number };
  receivable: { total: number; count: number };
  cheques: Cheque[];
}

export interface Paginated<T> {
  success: boolean;
  data: T[];
  meta: { total: number; pages: number; page: number };
}
