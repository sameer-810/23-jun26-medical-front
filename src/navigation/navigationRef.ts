/**
 * Container-level navigation handle for UI that lives OUTSIDE any navigator —
 * today, the offline strip above the drawer. Screens keep using useNavigation.
 */
import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

/** Opens the Offline & Sync review screen from anywhere. */
export function openOfflineSync() {
  if (!navigationRef.isReady()) return;
  // The container ref is untyped (root params live per-navigator); the
  // nested-navigation object form is the documented calling convention.
  (navigationRef.navigate as (name: string, params?: object) => void)("App", {
    screen: "Sales",
    params: { screen: "OfflineSync" },
  });
}
