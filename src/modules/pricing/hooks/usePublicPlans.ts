import { useQuery } from "@tanstack/react-query";
import { pricingApi } from "@modules/pricing/api/pricingApi";

/**
 * The public price list.
 *
 * Cached for a good while: prices change when the owner edits a plan in the
 * console, which is a handful of times a year, and this screen is often the
 * first request a brand-new visitor's browser ever makes.
 */
export function usePublicPlans() {
  return useQuery({
    queryKey: ["plans", "public"],
    queryFn: () => pricingApi.list(),
    staleTime: 5 * 60 * 1000,
  });
}
