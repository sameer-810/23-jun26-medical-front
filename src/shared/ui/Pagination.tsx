import React, { useMemo } from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react-native";
import { palette, radius, outline } from "../designSystem";
import { Text } from "./Text";

interface Props {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  pageSizes?: number[];
  /** Noun for the counter, e.g. "products" → "Showing 1–50 of 42,935 products". */
  label?: string;
}

/**
 * Pagination — back-office style page control: a range counter, rows-per-page,
 * and first/prev/numbered/next/last. Page numbers collapse to a compact
 * "Page x of n" on narrow screens where tapping small numbers is awkward.
 */
export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  pageSizes = [10, 20, 50, 100],
  label = "rows",
}: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 760;

  const pages = Math.max(1, totalPages);
  const hasPrev = page > 1;
  const hasNext = page < pages;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = total === 0 ? 0 : Math.min(page * limit, total);
  const n = (v: number) => v.toLocaleString("en-IN");

  // Windowed page numbers: 1 … 4 [5] 6 … 51
  const pageNums = useMemo<(number | "…")[]>(() => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, "…", pages];
    if (page >= pages - 2)
      return [1, "…", pages - 3, pages - 2, pages - 1, pages];
    return [1, "…", page - 1, page, page + 1, "…", pages];
  }, [page, pages]);

  if (total === 0) return null;

  return (
    <View style={styles.bar}>
      <Text variant="body-sm" tone="tertiary">
        Showing <Text variant="label">{n(start)}</Text>–
        <Text variant="label">{n(end)}</Text> of{" "}
        <Text variant="label">{n(total)}</Text> {label}
      </Text>

      {/* Rows per page */}
      <View style={styles.group}>
        <Text variant="body-sm" tone="tertiary">
          Rows:
        </Text>
        <View style={styles.sizes}>
          {pageSizes.map((size) => {
            const active = size === limit;
            return (
              <Pressable
                key={size}
                onPress={() => onLimitChange(size)}
                accessibilityRole="button"
                accessibilityLabel={`${size} rows per page`}
                style={[styles.size, active && styles.sizeActive]}
              >
                <Text
                  variant="label"
                  style={{
                    color: active ? "#FFFFFF" : palette.text.secondary,
                  }}
                >
                  {size}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Page controls */}
      <View style={styles.group}>
        <NavBtn
          disabled={!hasPrev}
          onPress={() => onPageChange(1)}
          label="First page"
        >
          <ChevronsLeft
            size={16}
            color={palette.text.secondary}
            strokeWidth={2}
          />
        </NavBtn>
        <NavBtn
          disabled={!hasPrev}
          onPress={() => onPageChange(page - 1)}
          label="Previous page"
        >
          <ChevronLeft
            size={16}
            color={palette.text.secondary}
            strokeWidth={2}
          />
        </NavBtn>

        {compact ? (
          <View style={styles.compact}>
            <Text variant="label">
              Page {n(page)} of {n(pages)}
            </Text>
          </View>
        ) : (
          pageNums.map((p, i) =>
            p === "…" ? (
              <Text
                key={`gap-${i}`}
                variant="body-sm"
                tone="tertiary"
                style={{ paddingHorizontal: 4 }}
              >
                …
              </Text>
            ) : (
              <Pressable
                key={p}
                onPress={() => onPageChange(p)}
                accessibilityRole="button"
                accessibilityLabel={`Page ${p}`}
                style={[styles.num, p === page && styles.numActive]}
              >
                <Text
                  variant="label"
                  style={{
                    color: p === page ? "#FFFFFF" : palette.text.secondary,
                  }}
                >
                  {p}
                </Text>
              </Pressable>
            ),
          )
        )}

        <NavBtn
          disabled={!hasNext}
          onPress={() => onPageChange(page + 1)}
          label="Next page"
        >
          <ChevronRight
            size={16}
            color={palette.text.secondary}
            strokeWidth={2}
          />
        </NavBtn>
        <NavBtn
          disabled={!hasNext}
          onPress={() => onPageChange(pages)}
          label="Last page"
        >
          <ChevronsRight
            size={16}
            color={palette.text.secondary}
            strokeWidth={2}
          />
        </NavBtn>
      </View>
    </View>
  );
}

function NavBtn({
  disabled,
  onPress,
  label,
  children,
}: {
  disabled?: boolean;
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[styles.nav, disabled && { opacity: 0.35 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: outline.width,
    borderColor: outline.color,
    backgroundColor: palette.surface.primary,
  },
  group: { flexDirection: "row", alignItems: "center", gap: 6 },
  sizes: {
    flexDirection: "row",
    gap: 2,
    padding: 2,
    borderRadius: radius.sm,
    backgroundColor: palette.surface.tertiary,
  },
  size: {
    minWidth: 34,
    height: 28,
    borderRadius: radius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeActive: { backgroundColor: palette.teal[700] },
  nav: {
    width: 30,
    minHeight: 30,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: outline.width,
    borderColor: outline.color,
  },
  num: {
    minWidth: 30,
    minHeight: 30,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  numActive: { backgroundColor: palette.teal[700] },
  compact: { paddingHorizontal: 8 },
});
