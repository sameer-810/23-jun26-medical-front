export interface PackUnit {
  unit: string;
  factor: number;
}

export type ScheduleDrug = "" | "H" | "H1" | "X" | "G" | "C";

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  saltComposition: string;
  categoryId: string | null;
  categoryName: string;
  brandId: string | null;
  brandName: string;
  description: string;
  baseUnit: string;
  packs: PackUnit[];
  sellingPrice: number;
  mrp: number;
  taxRatePct: number;
  hsnCode: string;
  reorderLevel: number;
  prescriptionRequired: boolean;
  scheduleDrug: ScheduleDrug;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  saltComposition: string;
  categoryName: string;
  brandName: string;
  baseUnit: string;
  packs: PackUnit[];
  sellingPrice: number;
  mrp: number;
  taxRatePct: number;
  reorderLevel: number;
  prescriptionRequired: boolean;
  scheduleDrug: ScheduleDrug;
  isActive: boolean;
  createdAt: string;
}

export interface ProductPayload {
  name: string;
  sku?: string;
  barcode?: string;
  saltComposition?: string;
  categoryId?: string | null;
  brandId?: string | null;
  description?: string;
  baseUnit?: string;
  packs?: PackUnit[];
  sellingPrice?: number;
  mrp?: number;
  taxRatePct?: number;
  hsnCode?: string;
  reorderLevel?: number;
  prescriptionRequired?: boolean;
  scheduleDrug?: ScheduleDrug;
  isActive?: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface Brand {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface Paginated<T> {
  success: boolean;
  data: T[];
  meta: { total: number; pages: number; page: number };
}

/** Customer-facing Medicine Guide, condensed from the catalogue. */
export interface MedicineGuide {
  use: string;
  sideEffects: string;
  warnings: string;
  storage: string;
  prescriptionRequired: boolean;
}

export interface ProductGuide {
  productId: string;
  name: string;
  guide: MedicineGuide | null;
  source: { catalogSku: string; manufacturerName: string } | null;
}
