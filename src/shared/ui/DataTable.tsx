/**
 * DataTable — the shared data grid. Quiet neutral header (small uppercase muted
 * labels + a hairline bottom border), click-to-sort columns, hairline rows with
 * a subtle hover, horizontal scroll for wide tables, optional client-side
 * pagination, and a mobile fallback that renders each row as a card. Replaces
 * the one hand-rolled Reports table and the copy-pasted card-row lists.
 */
import React, { useMemo, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import {
  ChevronUp,
  ChevronDown,
  Inbox,
  type LucideIcon,
} from "lucide-react-native";
import { palette } from "../designSystem";
import { Text } from "./Text";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Pagination } from "./Pagination";
import { ListGroup } from "./ListRow";

export interface Column<T> {
  key: string;
  header: string;
  width?: number;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render?: (row: T) => React.ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T, i: number) => string;
  onRowPress?: (row: T) => void;
  dense?: boolean;
  /** Client-side page size. 0 = show all (e.g. when the server already pages). */
  pageSize?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
  /** Narrow-screen card renderer; falls back to a label:value stack. */
  mobileCard?: (row: T) => React.ReactNode;
  mobileBreakpoint?: number;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  onRowPress,
  dense,
  pageSize = 0,
  initialSort,
  mobileCard,
  mobileBreakpoint = 760,
  emptyIcon,
  emptyTitle = "No data",
  emptyMessage,
}: Props<T>) {
  const { width } = useWindowDimensions();
  const narrow = width < mobileBreakpoint;
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const val = (r: T) =>
      col.sortValue ? col.sortValue(r) : (r as never)[col.key];
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [rows, sort, columns]);

  const paged =
    pageSize > 0
      ? sorted.slice((page - 1) * pageSize, page * pageSize)
      : sorted;
  const totalPages =
    pageSize > 0 ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;

  const toggleSort = (key: string) =>
    setSort((s) =>
      s?.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  if (rows.length === 0)
    return (
      <EmptyState
        icon={emptyIcon ?? Inbox}
        title={emptyTitle}
        message={emptyMessage}
      />
    );

  /**
   * ---- Mobile: one grouped list, not a stack of cards ----
   *
   * Each row used to be spaced 12px from the next, which was right when every
   * `mobileCard` was a bordered, shadowed Card. Now that they render as flat
   * `ListRow`s the gaps left them floating on the canvas with nothing holding
   * them together. `ListGroup` gives the run a single surface and hairline
   * dividers, which is what the desktop table is too — same data, same object,
   * one column instead of six.
   */
  if (narrow && mobileCard)
    return (
      <View>
        <ListGroup>
          {paged.map((r, i) => (
            <React.Fragment key={keyExtractor(r, i)}>
              {mobileCard(r)}
            </React.Fragment>
          ))}
        </ListGroup>
        {pageSize > 0 && rows.length > pageSize ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={rows.length}
            limit={pageSize}
            onPageChange={setPage}
            onLimitChange={() => {}}
          />
        ) : null}
      </View>
    );

  const pv = dense ? 7 : 9;

  // ---- Desktop / wide: table ----
  return (
    <View>
      <Card padded={false} style={{ overflow: "hidden" }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ minWidth: "100%" }}
        >
          <View style={{ minWidth: "100%" }}>
            {/* header */}
            <View style={[styles.row, styles.headerRow]}>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <Pressable
                    key={c.key}
                    disabled={!c.sortable}
                    onPress={() => c.sortable && toggleSort(c.key)}
                    style={[
                      styles.cell,
                      { width: c.width ?? 150, paddingVertical: pv },
                    ]}
                  >
                    <View
                      style={[
                        styles.headCell,
                        c.align === "right" && { justifyContent: "flex-end" },
                        c.align === "center" && { justifyContent: "center" },
                      ]}
                    >
                      <Text
                        variant="overline"
                        style={{
                          color: active
                            ? palette.text.secondary
                            : palette.text.tertiary,
                        }}
                        numberOfLines={1}
                      >
                        {c.header}
                      </Text>
                      {active ? (
                        sort!.dir === "asc" ? (
                          <ChevronUp
                            size={12}
                            color={palette.text.secondary}
                            strokeWidth={2.4}
                          />
                        ) : (
                          <ChevronDown
                            size={12}
                            color={palette.text.secondary}
                            strokeWidth={2.4}
                          />
                        )
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {/* rows */}
            {paged.map((r, i) => {
              const inner = (
                <View style={styles.row}>
                  {columns.map((c) => (
                    <View
                      key={c.key}
                      style={[
                        styles.cell,
                        { width: c.width ?? 150, paddingVertical: pv },
                        c.align === "right" && { alignItems: "flex-end" },
                        c.align === "center" && { alignItems: "center" },
                      ]}
                    >
                      {c.render ? (
                        c.render(r)
                      ) : (
                        <Text
                          variant="body-sm"
                          tone="secondary"
                          numberOfLines={1}
                        >
                          {String((r as never)[c.key] ?? "—")}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              );
              return onRowPress ? (
                <Pressable
                  key={keyExtractor(r, i)}
                  onPress={() => onRowPress(r)}
                  // RN-Web passes `hovered`; RN's types don't include it.
                  style={(state: { pressed: boolean; hovered?: boolean }) => [
                    state.hovered ? { backgroundColor: palette.ink[50] } : null,
                    state.pressed
                      ? { backgroundColor: palette.ink[100] }
                      : null,
                  ]}
                >
                  {inner}
                </Pressable>
              ) : (
                <View key={keyExtractor(r, i)}>{inner}</View>
              );
            })}
          </View>
        </ScrollView>
      </Card>
      {pageSize > 0 && rows.length > pageSize ? (
        <View style={{ marginTop: 12 }}>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={rows.length}
            limit={pageSize}
            onPageChange={setPage}
            onLimitChange={() => {}}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
  headerRow: {
    backgroundColor: palette.surface.sunken,
    // A hairline, like every other rule in the app. The 1.5px double-weight
    // line under the header was the only one of its kind in the product.
    borderBottomWidth: 1,
    borderBottomColor: palette.border.default,
  },
  headCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cell: {
    paddingHorizontal: 12,
    justifyContent: "center",
  },
});
