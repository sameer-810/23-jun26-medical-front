export interface Settings {
  id: string;
  organizationId: string;
  company: {
    legalName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email: string;
    logoUrl: string;
    drugLicenseNo: string;
    /** Second retail licence (Form 20 + Form 21 both print on the bill). */
    drugLicenseNo2?: string;
    gstin: string;
    /** "Subject to <city> jurisdiction" on the bill. */
    jurisdiction?: string;
    pharmacistName?: string;
    /** Footer mobile, when different from the landline. */
    mobile?: string;
    /** Owner signature / shop stamp printed on the invoice, as a data URI. */
    signatureImage?: string;
    signatureLabel?: string;
  };
  tax: {
    enabled: boolean;
    defaultRatePct: number;
    priceIncludesTax: boolean;
    invoicePrefix: string;
  };
  print?: {
    documentType: "tax_invoice" | "bill_of_supply";
    layout: "a4" | "text80";
    copies: "single" | "duplicate";
    guideOnBill: boolean;
  };
  currency: string;
  expiryAlertDays: number[];
  alertChannels: { inApp: boolean; email: boolean; sms: boolean };
  /**
   * What the platform quotes THIS pharmacy for the metered channels. Read-only
   * to the pharmacy; 0 means not quoted yet.
   */
  alertPricing?: {
    emailMonthly: number;
    smsMonthly: number;
    currency: string;
  };
  units: string[];
  defaultReorderLevel: number;
  /** Where "Email my backup" sends the archive. Empty = the admin's login email. */
  backupEmail: string;
  updatedAt: string;
}

export type SettingsPatch = {
  company?: Partial<Settings["company"]>;
  tax?: Partial<Settings["tax"]>;
  print?: Partial<NonNullable<Settings["print"]>>;
  currency?: string;
  expiryAlertDays?: number[];
  alertChannels?: Partial<Settings["alertChannels"]>;
  units?: string[];
  defaultReorderLevel?: number;
  backupEmail?: string;
};
