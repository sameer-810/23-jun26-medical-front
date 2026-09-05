import { apiClient } from "@api/apiClient";
import { PublicPlan } from "@modules/pricing/types";

/**
 * The price list, read without a session.
 *
 * `/plans` is public for a specific reason: the screen that calls it is the
 * one a pharmacy lands on the instant it finishes signing up, and a workspace
 * cannot sign in until the platform team activates it. There is no token to
 * send, and there must not need to be.
 */
export const pricingApi = {
  list: async (): Promise<PublicPlan[]> => {
    const res = await apiClient.get("/plans");
    return (res.data?.data ?? []) as PublicPlan[];
  },
};
