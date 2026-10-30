/**
 * A screen in its own JS chunk, so the first page load carries the login and
 * the till and not every screen a shop might one day open.
 *
 * Two things a plain `React.lazy` gets wrong for this app:
 *
 *  - Offline. The till must keep working after a power cut, and the service
 *    worker can only serve a chunk this browser has already fetched. So every
 *    screen registers a preloader, and `preloadScreens` walks them once after
 *    sign-in, which leaves the whole app in that cache as a single bundle did.
 *
 *  - A failed load. `React.lazy` remembers a rejection forever, so one blip
 *    would leave a section dead until a reload — and a chunk from an older
 *    deploy is simply gone from the host. Here the failure shows a way out.
 *    The till never reaches this: it is in the main bundle.
 *
 * On native, `import()` resolves from the single bundle; none of this costs
 * anything there.
 */
import React, { Component, Suspense, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { palette } from "@shared/designSystem";
import { Button } from "@shared/ui/Button";

type ScreenModule = { default: React.ComponentType<never> };
type Loader = () => Promise<ScreenModule>;

const preloaders: Loader[] = [];

class ChunkBoundary extends Component<
  { children: React.ReactNode; onRetry: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          This screen couldn&apos;t load. Check the connection and try again.
        </Text>
        <Button
          label="Try again"
          size="sm"
          fullWidth={false}
          onPress={this.props.onRetry}
        />
      </View>
    );
  }
}

/**
 * Wraps `() => import("...")` as a component a navigator can mount.
 * `preload: false` leaves it out of the sign-in preload: for the platform
 * console and anything else a pharmacy's staff never open.
 */
export function lazyScreen(
  load: Loader,
  { preload = true }: { preload?: boolean } = {},
): React.FunctionComponent<object> {
  const lazyOf = () => React.lazy(load as never) as React.ComponentType<object>;
  let Lazy = lazyOf();
  if (preload) preloaders.push(load);

  return function LazyScreen(props: object) {
    const [attempt, setAttempt] = useState(0);
    return (
      <ChunkBoundary
        key={attempt}
        onRetry={() => {
          Lazy = lazyOf();
          setAttempt((n) => n + 1);
        }}
      >
        <Suspense
          fallback={
            <View style={styles.center}>
              <ActivityIndicator color={palette.teal[600]} />
            </View>
          }
        >
          <Lazy {...props} />
        </Suspense>
      </ChunkBoundary>
    );
  };
}

/** Adds a non-screen chunk that must be there for offline use too. */
export const preloadAlso = (load: () => Promise<unknown>) =>
  preloaders.push(load as Loader);

const whenIdle = (fn: () => void) => {
  if (typeof requestIdleCallback === "function")
    requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 200);
};

let preloading = false;

function reportAssets() {
  if (!("serviceWorker" in navigator)) return;
  const urls = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((url) => /\/(_expo\/static|assets)\//.test(url));
  void navigator.serviceWorker.ready.then((registration) =>
    registration.active?.postMessage({ type: "keep", urls }),
  );
}

/**
 * Fetches every registered screen, one at a time and only when the browser is
 * idle, so it never competes with the page the pharmacist is using. A failure
 * is ignored: the screen just loads when opened, as it would have anyway.
 *
 * Then tells the service worker exactly what this build uses. It can't work that
 * out itself: a script the browser reuses from memory never reaches it, and on
 * the very first visit the page loaded before it was running at all.
 */
export function preloadScreens() {
  if (Platform.OS !== "web" || preloading) return;
  preloading = true;
  const next = () => {
    const load = preloaders.shift();
    if (!load) {
      reportAssets();
      return;
    }
    // Not `load().catch`: Metro answers an `import()` of something already
    // loaded with the module itself, not a promise.
    Promise.resolve()
      .then(load)
      .catch(() => undefined)
      .finally(() => whenIdle(next));
  };
  whenIdle(next);
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 16,
    backgroundColor: palette.surface.secondary,
  },
  message: { color: palette.text.secondary, fontSize: 14, textAlign: "center" },
});
