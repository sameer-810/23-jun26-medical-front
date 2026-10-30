import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  ChevronRight,
  PackageCheck,
  ScrollText,
  Download,
} from "lucide-react-native";
import { useReceipts } from "@modules/inventory/hooks/useInventory";
import { useSuppliers } from "@modules/supplier/hooks/useSuppliers";
import { ReceiptListItem } from "@modules/inventory/types";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { downloadBlob } from "@shared/download";
import { apiErrorMessage } from "@api/apiClient";
import { receiptPayable } from "@modules/inventory/receiptPayable";
import {
  fmtDate,
  fmtMoneyExact,
  fmtNumber,
  isInvertedRange,
} from "@shared/format";
import { palette } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  StatusChip,
  Pagination,
  DataTable,
  Column,
  Skeleton,
  Button,
  DateField,
  Select,
  Banner,
  ErrorState,
} from "@shared/ui";

const money = fmtMoneyExact;

export default function ReceiptsScreen() {
  const navigation = useNavigation<any>();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  /**
   * The window the register covers. Blank means "everything", which is what a
   * pharmacist wants on opening it — the filter is for answering a question
   * ("what came in during the first fortnight of August?"), not a gate.
   */
  /** Invoice history per supplier — the question pharmacists actually ask. */
  const route = useRoute<{
    key: string;
    name: string;
    params?: { supplierId?: string };
  }>();
  const [supplierId, setSupplierId] = useState<string | null>(
    route.params?.supplierId ?? null,
  );
  const { data: suppliers } = useSuppliers();
  const supplierOptions = (suppliers?.data || []).map((s) => ({
    value: s.id,
    label: s.name,
  }));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useReceipts({
      page,
      limit,
      supplierId: supplierId || undefined,
      from: from || undefined,
      to: to || undefined,
    });

  const download = async (format: "pdf" | "excel") => {
    setBusy(true);
    setNote(null);
    try {
      const blob = await inventoryApi.exportReceipts({
        supplierId: supplierId || undefined,
        from: from || undefined,
        to: to || undefined,
        format,
      });
      const ext = format === "excel" ? "xlsx" : "pdf";
      const ok = await downloadBlob(blob, `purchase-register.${ext}`);
      setNote(
        ok
          ? `Downloaded ${total} receipt${total === 1 ? "" : "s"} as ${ext.toUpperCase()}.`
          : "Downloads work in the browser and desktop app — open Plusveda there to save the file.",
      );
    } catch (e) {
      setNote(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const receipts = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.pages ?? 1;

  // Snap back if the result set shrank below the current page.
  if (!isLoading && totalPages > 0 && page > totalPages) setPage(totalPages);

  const open = (r: ReceiptListItem) =>
    navigation.navigate("ReceiptDetail", { id: r.id });

  const columns: Column<ReceiptListItem>[] = [
    {
      key: "referenceNo",
      header: "Invoice",
      width: 170,
      sortable: true,
      sortValue: (r) => r.referenceNo || r.receiptNo,
      // The supplier's own bill number leads: it is what is printed on the
      // paper in the pharmacist's hand. Our GRN number sits underneath. A
      // voided entry keeps its row but counts for nothing, so it is marked.
      render: (r) => (
        <VStack gap={1}>
          <HStack gap={6} align="center">
            <Text
              variant="label"
              tone={r.status === "void" ? "tertiary" : "primary"}
              numberOfLines={1}
            >
              {r.referenceNo || "No invoice no."}
            </Text>
            {r.status === "void" ? (
              <StatusChip label="Void" tone="danger" />
            ) : null}
          </HStack>
          <Text variant="caption" tone="tertiary">
            {r.receiptNo}
          </Text>
        </VStack>
      ),
    },
    {
      key: "supplierName",
      header: "Supplier",
      width: 190,
      sortable: true,
      sortValue: (r) => (r.supplierName || "").toLowerCase(),
      render: (r) => (
        <Text variant="body-sm" tone="secondary" numberOfLines={1}>
          {r.supplierName || "No supplier"}
        </Text>
      ),
    },
    {
      key: "receivedAt",
      header: "Date",
      width: 120,
      sortable: true,
      sortValue: (r) => r.receivedAt,
      render: (r) => (
        <Text variant="body-sm" tone="tertiary">
          {fmtDate(r.receivedAt)}
        </Text>
      ),
    },
    {
      key: "lineCount",
      header: "Lines",
      width: 80,
      align: "center",
      sortable: true,
      sortValue: (r) => r.lineCount,
      render: (r) => (
        <Text variant="body-sm" tone="secondary">
          {r.lineCount}
        </Text>
      ),
    },
    {
      key: "totalQuantity",
      header: "Qty",
      width: 90,
      align: "center",
      sortable: true,
      sortValue: (r) => r.totalQuantity,
      render: (r) => (
        <Text variant="body-sm" tone="secondary">
          {r.totalQuantity}
        </Text>
      ),
    },
    {
      key: "payable",
      header: "Value",
      width: 120,
      align: "right",
      sortable: true,
      sortValue: receiptPayable,
      render: (r) => (
        <Text variant="label" tone="primary">
          {money(receiptPayable(r))}
        </Text>
      ),
    },
  ];

  return (
    <Screen
      back="Back to purchase"
      overline="Stock Inward"
      title="Purchase history"
      subtitle={
        isError
          ? undefined
          : `${total.toLocaleString("en-IN")} supplier invoice${total === 1 ? "" : "s"}`
      }
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
    >
      {/* Filter first, then export what you filtered — the download always
          matches the list on screen, so the two can never disagree. */}
      <Card style={{ marginBottom: 12 }}>
        <HStack gap={10} align="flex-end" wrap>
          <View style={{ minWidth: 220, flexGrow: 1, maxWidth: 320 }}>
            <Select
              label="Supplier"
              placeholder="All suppliers"
              value={supplierId}
              options={supplierOptions}
              onChange={(v) => {
                setSupplierId(v);
                setPage(1);
              }}
              allowClear
              searchable
            />
          </View>
          <DateField
            label="From"
            value={from}
            onChange={(v) => {
              setFrom(v);
              setPage(1);
            }}
            width={150}
          />
          <DateField
            label="To"
            value={to}
            onChange={(v) => {
              setTo(v);
              setPage(1);
            }}
            error={
              isInvertedRange(from, to)
                ? "Can't be before the From date"
                : undefined
            }
            width={150}
          />
          {from || to ? (
            <Button
              label="Clear"
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => {
                setFrom("");
                setTo("");
                setPage(1);
              }}
            />
          ) : null}
          <View style={{ flex: 1 }} />
          <Button
            label="PDF"
            size="sm"
            variant="secondary"
            fullWidth={false}
            loading={busy}
            icon={
              <Download
                size={15}
                color={palette.text.secondary}
                strokeWidth={2}
              />
            }
            onPress={() => void download("pdf")}
          />
          <Button
            label="Excel"
            size="sm"
            variant="secondary"
            fullWidth={false}
            loading={busy}
            onPress={() => void download("excel")}
          />
        </HStack>
      </Card>

      {note ? (
        <Banner tone="info" message={note} style={{ marginBottom: 12 }} />
      ) : null}

      {isError ? (
        <ErrorState
          error={error}
          title="Couldn't load the purchase register"
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      ) : isLoading && receipts.length === 0 ? (
        <ListSkeleton />
      ) : (
        <>
          <DataTable<ReceiptListItem>
            // Filtered to one supplier, its name on every row says nothing.
            columns={
              supplierId
                ? columns.filter((c) => c.key !== "supplierName")
                : columns
            }
            rows={receipts}
            keyExtractor={(r) => r.id}
            onRowPress={open}
            mobileCard={(r) => (
              <ReceiptRow receipt={r} onPress={() => open(r)} />
            )}
            emptyIcon={ScrollText}
            emptyTitle="No receipts yet"
            emptyMessage="Purchases you enter will be listed here."
          />
          {receipts.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={setLimit}
                label="receipts"
              />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function ListSkeleton() {
  return (
    <VStack gap={12}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Card key={i} elevation="base">
          <HStack gap={14} align="center">
            <Skeleton width={22} height={22} rounded="sm" />
            <VStack gap={6} flex={1}>
              <Skeleton width="40%" height={16} />
              <Skeleton width="70%" height={12} />
            </VStack>
            <Skeleton width={70} height={16} />
          </HStack>
        </Card>
      ))}
    </VStack>
  );
}

function ReceiptRow({
  receipt,
  onPress,
}: {
  receipt: ReceiptListItem;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} elevation="base">
      <HStack gap={14} align="center">
        <PackageCheck size={22} color={palette.teal[600]} strokeWidth={1.9} />
        <VStack gap={4} flex={1}>
          <HStack gap={6} align="center">
            <Text
              variant="label-lg"
              tone={receipt.status === "void" ? "tertiary" : "primary"}
            >
              {receipt.referenceNo || receipt.receiptNo}
            </Text>
            {receipt.status === "void" ? (
              <StatusChip label="Void" tone="danger" />
            ) : null}
          </HStack>
          <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
            {[
              receipt.supplierName || "No supplier",
              receipt.referenceNo ? receipt.receiptNo : "",
              fmtDate(receipt.receivedAt),
              receipt.receivedByName,
            ]
              .filter(Boolean)
              .join("  ·  ")}
          </Text>
          <HStack gap={6} wrap>
            <StatusChip
              label={`${receipt.lineCount} line${receipt.lineCount === 1 ? "" : "s"}`}
              tone="neutral"
            />
            <StatusChip
              label={`${fmtNumber(receipt.totalQuantity)} unit${receipt.totalQuantity === 1 ? "" : "s"}`}
              tone="info"
            />
            <StatusChip label={money(receiptPayable(receipt))} tone="success" />
          </HStack>
        </VStack>
        <ChevronRight size={18} color={palette.text.tertiary} strokeWidth={2} />
      </HStack>
    </Card>
  );
}
