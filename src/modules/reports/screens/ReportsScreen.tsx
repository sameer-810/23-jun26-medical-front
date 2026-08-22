import React, { useState } from "react";
import { View } from "react-native";
import { FileSpreadsheet, FileText, BarChart3 } from "lucide-react-native";
import {
  useReport,
  useDownloadReport,
} from "@modules/reports/hooks/useReports";
import { ReportType, ReportColumn } from "@modules/reports/api/reportsApi";
import { apiErrorMessage } from "@api/apiClient";
import { fmtMoneyExact, fmtDate } from "@shared/format";
import { palette, layout } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  DateField,
  ChipsRow,
  EmptyState,
  DataTable,
  Column,
  useBreakpoint,
} from "@shared/ui";

type ReportRow = Record<string, unknown>;

/**
 * Inventory, Batch, Stock movement and Purchase are deliberately absent.
 *
 * Each of them exports the pharmacy's full stock or purchase list, which a
 * member can download and carry into another system. The owner asked for them
 * to go for exactly that reason. The endpoints still exist and are still
 * permission-checked — this removes the one-click export from the workbench,
 * not the data model.
 */
/**
 * GST is offered alongside them: it is a rate- and HSN-wise TAX SUMMARY for
 * GSTR-1, not a line-by-line list of what the pharmacy stocks or buys, so it
 * does not carry the leak the four above were removed for.
 */
const TYPES: { key: ReportType; label: string; timed: boolean }[] = [
  { key: "sales", label: "Sales", timed: true },
  { key: "gst", label: "GST (HSN)", timed: true },
  { key: "expiry", label: "Expiry", timed: false },
  { key: "warehouse", label: "Warehouse", timed: false },
  { key: "user-activity", label: "User activity", timed: true },
];

// A report is read against a piece of paper, so it uses the exact formatter —
// the exports already print 2dp, and a screen that drops trailing paise
// disagrees with the file generated from the very same rows.
const money = fmtMoneyExact;

/**
 * Which summary keys are rupees.
 *
 * Counts ("Invoices", "HSN groups") must stay plain. The list is explicit
 * because a name-matching rule missed "Refunds", which then printed as a bare
 * `-272.46` in a row of ₹ figures.
 */
const MONEY_STAT =
  /value|total|tax|taxable|refund|payable|paid|due|cost|price|cgst|sgst|igst/i;
const COUNT_STAT =
  /invoices|groups|count|rows|products|batches|locations|movements|units/i;
const isMoneyStat = (k: string) => MONEY_STAT.test(k) && !COUNT_STAT.test(k);

function fmt(value: unknown, col: ReportColumn) {
  if (value == null || value === "") return "—";
  if (col.type === "money") return money(Number(value));
  if (col.type === "number") return String(value);
  // `toISOString` renders in UTC, so a sale at 00:01 IST printed as the
  // PREVIOUS day — inside a report whose header stated today's range. Dates go
  // through the shared IST formatter, like the rest of the app.
  if (col.type === "date") return fmtDate(value as string);
  return String(value);
}

export default function ReportsScreen() {
  const { isWide } = useBreakpoint();
  const gutter = isWide ? layout.screenPadding : layout.screenPaddingPhone;
  // Must be one of TYPES above — "inventory" was removed, and defaulting to a
  // type with no chip left the screen loading a report nothing could select.
  const [type, setType] = useState<ReportType>("sales");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const meta = TYPES.find((t) => t.key === type)!;
  const params = { from: from.trim() || undefined, to: to.trim() || undefined };
  const { data, isLoading, isError, error, refetch, isRefetching } = useReport(
    type,
    params,
  );
  const download = useDownloadReport();

  return (
    <Screen
      overline="Insights"
      title="Reports"
      subtitle="Filter, view and export to Excel or PDF"
      refreshing={isRefetching}
      onRefresh={refetch}
    >
      {/* Type selector. The bleed has to MATCH the screen's own gutter — a
          hardcoded 24 overshot a phone's 16 and pushed the page 8px sideways. */}
      <View style={{ marginHorizontal: -gutter, marginBottom: 16 }}>
        <ChipsRow
          chips={TYPES.map((t) => ({ key: t.key, label: t.label }))}
          active={type}
          onChange={(k) => setType(k as ReportType)}
        />
      </View>

      {/* Date range (timed reports) + exports */}
      <Card style={{ marginBottom: 16 }}>
        <VStack gap={14}>
          {meta.timed && (
            <HStack gap={12}>
              <View style={{ flex: 1 }}>
                <DateField
                  label="From"
                  value={from}
                  onChange={setFrom}
                  maximumDate={new Date()}
                />
              </View>
              <View style={{ flex: 1 }}>
                <DateField
                  label="To"
                  value={to}
                  onChange={setTo}
                  maximumDate={new Date()}
                />
              </View>
            </HStack>
          )}
          <HStack gap={10} wrap>
            <Button
              label="Export Excel"
              variant="secondary"
              fullWidth={false}
              icon={
                <FileSpreadsheet
                  size={16}
                  color={palette.teal[600]}
                  strokeWidth={2}
                />
              }
              loading={
                download.isPending && download.variables?.format === "excel"
              }
              onPress={() => download.mutate({ type, format: "excel", params })}
            />
            <Button
              label="Export PDF"
              variant="secondary"
              fullWidth={false}
              icon={
                <FileText
                  size={16}
                  color={palette.cobalt[600]}
                  strokeWidth={2}
                />
              }
              loading={
                download.isPending && download.variables?.format === "pdf"
              }
              onPress={() => download.mutate({ type, format: "pdf", params })}
            />
          </HStack>
          {download.isError && (
            <Text variant="caption" tone="danger">
              {apiErrorMessage(download.error, "Export failed")}
            </Text>
          )}
        </VStack>
      </Card>

      {/* Summary */}
      {data?.summary && (
        <Card style={{ marginBottom: 16 }}>
          <HStack gap={20} wrap>
            {Object.entries(data.summary).map(([k, v]) => (
              <VStack key={k} gap={2}>
                <Text variant="caption" tone="tertiary">
                  {k}
                </Text>
                <Text variant="h3" tone="primary">
                  {typeof v === "number" && isMoneyStat(k)
                    ? money(v)
                    : String(v)}
                </Text>
              </VStack>
            ))}
          </HStack>
        </Card>
      )}

      {/* Table */}
      {isError ? (
        <EmptyState
          icon={BarChart3}
          title="Couldn't load report"
          message={apiErrorMessage(error)}
        />
      ) : (
        <DataTable<ReportRow>
          columns={(data?.columns ?? []).map(toColumn)}
          rows={(data?.rows as ReportRow[]) ?? []}
          keyExtractor={(_, i) => String(i)}
          pageSize={50}
          dense
          emptyIcon={BarChart3}
          emptyTitle={isLoading ? "Loading…" : "No data"}
          emptyMessage="No records for this report or date range."
        />
      )}
    </Screen>
  );
}

function colWidth(c: ReportColumn) {
  if (c.type === "money") return 130;
  if (c.type === "number") return 90;
  if (c.type === "date") return 110;
  return 170;
}

/** Map a server report column to a sortable DataTable column. */
function toColumn(c: ReportColumn): Column<ReportRow> {
  const numeric = c.type === "money" || c.type === "number";
  return {
    key: c.key,
    header: c.label,
    width: colWidth(c),
    align: numeric ? "right" : "left",
    sortable: true,
    sortValue: (r) =>
      numeric ? Number(r[c.key]) || 0 : String(r[c.key] ?? ""),
    render: (r) => (
      <Text variant="body-sm" tone="secondary" numberOfLines={1}>
        {fmt(r[c.key], c)}
      </Text>
    ),
  };
}
