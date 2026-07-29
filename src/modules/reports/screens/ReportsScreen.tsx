import React, { useState } from "react";
import { View } from "react-native";
import { FileSpreadsheet, FileText, BarChart3 } from "lucide-react-native";
import {
  useReport,
  useDownloadReport,
} from "@modules/reports/hooks/useReports";
import { ReportType, ReportColumn } from "@modules/reports/api/reportsApi";
import { apiErrorMessage } from "@api/apiClient";
import { palette } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  TextField,
  ChipsRow,
  EmptyState,
  DataTable,
  Column,
} from "@shared/ui";

type ReportRow = Record<string, unknown>;

const TYPES: { key: ReportType; label: string; timed: boolean }[] = [
  { key: "inventory", label: "Inventory", timed: false },
  { key: "sales", label: "Sales", timed: true },
  { key: "expiry", label: "Expiry", timed: false },
  { key: "batch", label: "Batch", timed: false },
  { key: "stock-movement", label: "Stock movement", timed: true },
  { key: "warehouse", label: "Warehouse", timed: false },
  { key: "purchase", label: "Purchase", timed: true },
  { key: "user-activity", label: "User activity", timed: true },
];

const money = (n: number) =>
  `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function fmt(value: unknown, col: ReportColumn) {
  if (value == null || value === "") return "—";
  if (col.type === "money") return money(Number(value));
  if (col.type === "number") return String(value);
  if (col.type === "date")
    return new Date(value as string).toISOString().slice(0, 10);
  return String(value);
}

export default function ReportsScreen() {
  const [type, setType] = useState<ReportType>("inventory");
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
      {/* Type selector */}
      <View style={{ marginHorizontal: -24, marginBottom: 16 }}>
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
                <TextField
                  label="From"
                  value={from}
                  onChangeText={setFrom}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="To"
                  value={to}
                  onChangeText={setTo}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
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
                  {typeof v === "number" &&
                  k.toLowerCase().match(/value|total|tax|taxable/)
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
