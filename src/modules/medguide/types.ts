export interface Interactions {
  alcohol: string;
  pregnancy: string;
  lactation: string;
  driving: string;
  kidney: string;
  liver: string;
}

export interface MedicineInfo {
  introduction: string;
  benefits: string;
  howToUse: string;
  howItWorks: string;
  safetyAdvice: string;
  ifMissed: string;
  sideEffects: string;
  storage: string;
  primaryUse: string;
  factBox: string;
  faq: string;
  drugInteractions: string;
  marketerDetails: string;
  interactions: Interactions;
}

export interface Medicine {
  _id: string;
  sku: string;
  name: string;
  saltComposition: string;
  manufacturerName: string;
  mrp: number;
  prescriptionRequired: boolean;
  productForm: string;
  packLabel: string;
  medicineType: string;
  countryOfOrigin: string;
  images: string[];
  uses: string[];
  sideEffects: string[];
  substitutes: string[];
  drugClass?: {
    chemical: string;
    therapeutic: string;
    action: string;
    habitForming: string;
  };
  medicineInfo?: MedicineInfo;
}

/**
 * No `total`/`pages` on purpose — the global catalogue's size is platform IP and
 * is never exposed to a pharmacy. Paging is driven by `hasMore` alone.
 */
export interface MedGuideMeta {
  page: number;
  limit: number;
  hasMore: boolean;
}
