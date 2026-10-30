/**
 * Leave a form after a save.
 *
 * `goBack()` assumes something of ours sits underneath. A form opened cold — by
 * URL, a reload or the ⌘K palette — is the only route in its stack, so the pop
 * either goes nowhere or bubbles up and drops the pharmacist on the dashboard.
 * Same test as `Screen`'s back link: pop while there is something of ours to pop
 * to, otherwise go to the list. It replaces, so Back can't reopen a saved form.
 */
export interface BackNavigation {
  canGoBack: () => boolean;
  goBack: () => void;
  getState?: () => { type?: string; index?: number } | undefined;
  navigate: (name: string, params?: object) => void;
  /** Stack navigators only. */
  replace?: (name: string, params?: object) => void;
}

export function goBackOr(
  navigation: BackNavigation,
  fallback: string,
  params?: object,
) {
  const state = navigation.getState?.();
  const depth = state?.type === "stack" ? (state.index ?? 0) : 0;
  if (depth > 0 && navigation.canGoBack()) navigation.goBack();
  else if (navigation.replace) navigation.replace(fallback, params);
  else navigation.navigate(fallback, params);
}
