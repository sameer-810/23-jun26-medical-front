/**
 * ⌘K command palette — a single overlay to jump to any section or fire a quick
 * action, keyboard-first. Opens on ⌘K / Ctrl+K from anywhere, filters fuzzily,
 * and executes on Enter. Commands are built from the same permission-gated nav
 * items as the sidebar, so it never offers a place the user can't go.
 *
 * A category-level differentiator: none of the flagship pharmacy tools ship a
 * real command palette.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Search,
  CornerDownLeft,
  ShoppingCart,
  PackagePlus,
  ShoppingBag,
  Package,
  Contact,
  Truck,
  ArrowRight,
  type LucideIcon,
} from "lucide-react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { palette, radius, shadows } from "@shared/designSystem";
import { Text } from "@shared/ui";
import { useVisibleNavItems } from "./navItems";

type Nav = { navigate: (name: string, params?: unknown) => void };
interface Command {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  keywords: string;
  kind: "action" | "nav";
  run: (nav: Nav) => void;
}

/** Nested-navigate into the drawer (`App`) → section → optional deep screen. */
const toSection = (section: string, screen?: string) => (nav: Nav) =>
  nav.navigate(
    "App",
    screen ? { screen: section, params: { screen } } : { screen: section },
  );

/** Fuzzy subsequence test — every query char appears in order in the target. */
function subseq(q: string, t: string): boolean {
  let i = 0;
  for (let j = 0; j < t.length && i < q.length; j++) {
    if (q[i] === t[j]) i++;
  }
  return i === q.length;
}

function score(cmd: Command, q: string): number | null {
  if (!q) return cmd.kind === "action" ? 0 : 1; // actions first when idle
  const label = cmd.label.toLowerCase();
  const hay = `${label} ${cmd.hint} ${cmd.keywords}`.toLowerCase();
  if (label.startsWith(q)) return -3;
  if (label.includes(q)) return -2;
  if (hay.includes(q)) return -1;
  if (subseq(q, hay)) return 0;
  return null;
}

export function CommandPalette() {
  const nav = useNavigation() as unknown as Nav;
  const navItems = useVisibleNavItems();
  const has = useAuthStore((s) => s.hasPermission);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const commands = useMemo<Command[]>(() => {
    const actionDefs: { perm: string; cmd: Command }[] = [
      {
        perm: PERMISSIONS.SALES_MANAGE,
        cmd: {
          id: "a-sale",
          label: "New sale",
          hint: "Sales",
          icon: ShoppingCart,
          keywords: "bill invoice pos checkout",
          kind: "action",
          run: toSection("Sales", "NewSale"),
        },
      },
      {
        perm: PERMISSIONS.STOCK_INWARD_MANAGE,
        cmd: {
          id: "a-receive",
          label: "Receive stock",
          hint: "Purchasing",
          icon: PackagePlus,
          keywords: "grn goods inward purchase",
          kind: "action",
          run: toSection("Receive", "ReceiveStock"),
        },
      },
      {
        perm: PERMISSIONS.PURCHASES_MANAGE,
        cmd: {
          id: "a-po",
          label: "New purchase order",
          hint: "Purchasing",
          icon: ShoppingBag,
          keywords: "po order reorder",
          kind: "action",
          run: toSection("Orders", "OrderForm"),
        },
      },
      {
        perm: PERMISSIONS.PRODUCTS_MANAGE,
        cmd: {
          id: "a-product",
          label: "Add product",
          hint: "Catalogue",
          icon: Package,
          keywords: "new item medicine sku",
          kind: "action",
          run: toSection("Products", "ProductForm"),
        },
      },
      {
        perm: PERMISSIONS.CUSTOMERS_MANAGE,
        cmd: {
          id: "a-customer",
          label: "Add customer",
          hint: "Sales",
          icon: Contact,
          keywords: "new patient party",
          kind: "action",
          run: toSection("Customers", "CustomerForm"),
        },
      },
      {
        perm: PERMISSIONS.SUPPLIERS_MANAGE,
        cmd: {
          id: "a-supplier",
          label: "Add supplier",
          hint: "Purchasing",
          icon: Truck,
          keywords: "new distributor vendor party",
          kind: "action",
          run: toSection("Suppliers", "SupplierForm"),
        },
      },
    ];
    const actions: Command[] = actionDefs
      .filter((a) => has(a.perm))
      .map((a) => a.cmd);

    const navs: Command[] = navItems.map((it) => ({
      id: `n-${it.name}`,
      label: it.label,
      hint: it.section,
      icon: it.icon,
      keywords: "go open view",
      kind: "nav",
      run: toSection(it.name),
    }));
    return [...actions, ...navs];
  }, [navItems, has]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return commands
      .map((c) => ({ c, s: score(c, q) }))
      .filter((r) => r.s !== null)
      .sort((a, b) => a.s! - b.s! || a.c.label.localeCompare(b.c.label))
      .map((r) => r.c);
  }, [commands, query]);

  const run = useCallback(
    (cmd?: Command) => {
      if (!cmd) return;
      setOpen(false);
      cmd.run(nav);
    },
    [nav],
  );

  // Stable global key handler reads live state from a ref (avoids re-binding the
  // listener and the stale-closure trap — same pattern as the POS keyboard).
  const live = useRef({ open, results, active, run });
  useEffect(() => {
    live.current = { open, results, active, run };
  });
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      const s = live.current;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const willOpen = !s.open;
        setOpen(willOpen);
        if (willOpen) {
          setQuery("");
          setActive(0);
        }
        return;
      }
      if (!s.open) return;
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, s.results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
      // Enter is handled by the input's onSubmitEditing — a single-line RNW
      // TextInput swallows the Enter keydown before it reaches the document.
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  let lastKind: string | null = null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => setOpen(false)}
    >
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
        <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
          <View style={styles.searchRow}>
            <Search size={18} color={palette.text.tertiary} strokeWidth={2} />
            <TextInput
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                setActive(0);
              }}
              onSubmitEditing={() => run(results[active])}
              blurOnSubmit={false}
              returnKeyType="go"
              placeholder="Search actions and screens…"
              placeholderTextColor={palette.text.tertiary}
              autoFocus
              style={[
                styles.input,
                // @ts-expect-error web-only outline reset
                { outlineStyle: "none" },
              ]}
            />
            <View style={styles.kbd}>
              <Text variant="label-sm" tone="tertiary">
                esc
              </Text>
            </View>
          </View>

          <ScrollView
            style={{ maxHeight: 360 }}
            keyboardShouldPersistTaps="handled"
          >
            {results.length === 0 ? (
              <View style={styles.empty}>
                <Text variant="body-sm" tone="tertiary">
                  No match for “{query}”.
                </Text>
              </View>
            ) : (
              results.map((c, i) => {
                const header =
                  c.kind !== lastKind
                    ? c.kind === "action"
                      ? "Actions"
                      : "Go to"
                    : null;
                lastKind = c.kind;
                const selected = i === active;
                return (
                  <View key={c.id}>
                    {header ? (
                      <Text
                        variant="overline"
                        tone="tertiary"
                        style={styles.group}
                      >
                        {header}
                      </Text>
                    ) : null}
                    <Pressable
                      onPress={() => run(c)}
                      onHoverIn={() => setActive(i)}
                      style={[styles.row, selected && styles.rowActive]}
                    >
                      <View
                        style={[
                          styles.rowIcon,
                          selected && { backgroundColor: palette.teal[100] },
                        ]}
                      >
                        <c.icon
                          size={17}
                          color={
                            selected
                              ? palette.teal[700]
                              : palette.text.secondary
                          }
                          strokeWidth={2}
                        />
                      </View>
                      <Text
                        variant="label"
                        tone="primary"
                        style={{ flex: 1 }}
                        numberOfLines={1}
                      >
                        {c.label}
                      </Text>
                      <Text variant="caption" tone="tertiary">
                        {c.hint}
                      </Text>
                      {selected ? (
                        <CornerDownLeft
                          size={15}
                          color={palette.text.tertiary}
                          strokeWidth={2}
                        />
                      ) : (
                        <ArrowRight
                          size={15}
                          color={palette.border.strong}
                          strokeWidth={2}
                        />
                      )}
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Text variant="label-sm" tone="tertiary">
              ↑↓ to navigate · ↵ to open · esc to close
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    paddingTop: "9%",
    paddingHorizontal: 20,
  },
  panel: {
    width: "100%",
    maxWidth: 580,
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border.default,
    ...shadows.xl,
    overflow: "hidden",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    height: 54,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: palette.text.primary,
    height: "100%",
  },
  kbd: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: palette.neutral[50],
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  group: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    marginHorizontal: 6,
    height: 44,
    borderRadius: radius.md,
  },
  rowActive: {
    backgroundColor: palette.teal[50],
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: palette.neutral[50],
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    padding: 24,
    alignItems: "center",
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border.subtle,
    backgroundColor: palette.neutral[50],
  },
});
