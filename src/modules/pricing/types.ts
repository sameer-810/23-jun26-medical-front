/**
 * A plan as the public price list serves it.
 *
 * Everything past `termMonths` is DERIVED server-side by planDisplay.js and
 * arrives ready to print. It is not recomputed here on purpose: the landing
 * site, this screen and the superadmin console would otherwise each hold their
 * own copy of the discount arithmetic, and a chemist reads two of them within
 * about ten seconds of each other.
 */
export interface PublicPlan {
  id: string;
  code: string;
  name: string;
  tagline: string;
  description: string;
  /** Length of the commitment. 1 = month to month. */
  termMonths: number;
  /** The headline rate the card leads with. */
  perMonth: number;
  /** Rupees, paid once, for the whole term — what actually gets charged. */
  total: number;
  /** The struck-through "Instead of" figure. */
  reference: number;
  /** reference − total. 0 on the month-to-month plan. */
  saves: number;
  savePct: number;
  /** e.g. "Save 78%". Empty when there is nothing to claim. */
  badge: string;
  isFeatured: boolean;
  features: string[];
  maxUsers: number;
  maxProducts: number;
}
