import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  ChevronRight,
  PackageCheck,
  ScrollText,
  Download,
} from "lucide-react-native";
import { useReceipts } from "@modules/inventory/hooks/useInventory";
import { ReceiptListItem } from "@modules/inventory/types";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { downloadBlob } from "@shared/download";
import { apiErrorMessage } from "@api/apiClient";
import { fmtDate } from "@shared/format";
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
  Banner,
  ErrorState,
} from "@shared/ui";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function ReceiptsScreen() {
  const navigation = useNavigation<any>();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  /**
   * The window the register covers. Blank means "everything", which is what a
   * pharmacist wants on opening it — the filter is for answering a question
   * ("what came in during the first fortnight of August?"), not a gate.
   */
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useReceipts({
      page,
      limit,
      from: from || undefined,
      to: to || undefined,
    });

  const download = async (format: "pdf" | "excel") => {
    setBusy(true);
    setNote(null);
    try {
      const blob = await inventoryApi.exportReceipts({
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
      key: "receiptNo",
      header: "Receipt",
      width: 150,
      sortable: true,
      sortValue: (r) => r.receiptNo,
      // A voided GRN keeps its row but contributes nothing, so it has to be
      // distinguishable from a live one at a glance.
      render: (r) => (
        <HStack gap={6} align="center">
          <Text
            variant="label"
            tone={r.status === "void" ? "tertiary" : "primary"}
          >
            {r.receiptNo}
          </Text>
          {r.status === "void" ? (
            <StatusChip label="Void" tone="danger" />
          ) : null}
        </HStack>
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
          {new Date(r.receivedAt).toLocaleDateString("en-IN")}
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
      key: "totalValue",
      header: "Value",
      width: 120,
      align: "right",
      sortable: true,
      sortValue: (r) => r.totalValue,
      render: (r) => (
        <Text variant="label" tone="primary">
          {money(r.totalValue)}
        </Text>
      ),
    },
  ];

  return (
    <Screen
      back="Back to receive"
      overline="Stock Inward"
      title="Receipt history"
      subtitle={
        isError
          ? undefined
          : `${total.toLocaleString("en-IN")} goods-received notes`
      }
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
    >
      {/* Filter first, then export what you filtered — the download always
          matches the list on screen, so the two can never disagree. */}
      <Card style={{ marginBottom: 12 }}>
        <HStack gap={10} align="flex-end" wrap>
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
            columns={columns}
            rows={receipts}
            keyExtractor={(r) => r.id}
            onRowPress={open}
            mobileCard={(r) => (
              <ReceiptRow receipt={r} onPress={() => open(r)} />
            )}
            emptyIcon={ScrollText}
            emptyTitle="No receipts yet"
            emptyMessage="Received stock will be listed here as GRNs."
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
              {receipt.receiptNo}
            </Text>
            {receipt.status === "void" ? (
              <StatusChip label="Void" tone="danger" />
            ) : null}
          </HStack>
          <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
            {[
              receipt.supplierName || "No supplier",
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
            <StatusChip label={`${receipt.totalQuantity} units`} tone="info" />
            <StatusChip label={money(receipt.totalValue)} tone="success" />
          </HStack>
        </VStack>
        <ChevronRight size={18} color={palette.text.tertiary} strokeWidth={2} />
      </HStack>
    </Card>
  );
}
