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

/**
 * A cheque read by the camera, split by how far it can be trusted.
 *
 * `autofill` is machine-printed on a CTS-2010 cheque and safe to write into the
 * form. `confirm` is the money and the date — the two fields the register
 * requires, usually handwritten, and impossible for us to validate against
 * anything we hold. Those stay a human decision.
 */
export interface ChequeRead {
  autofill: { chequeNo: string | null; bankName: string };
  confirm: {
    amount: number | null;
    chequeDate: string | null;
    amountInWords: string | null;
    payeeName: string | null;
  };
  meta: {
    ifsc: string | null;
    accountNo: string | null;
    amountIsHandwritten: boolean;
    dateIsHandwritten: boolean;
  };
  warnings: string[];
}
