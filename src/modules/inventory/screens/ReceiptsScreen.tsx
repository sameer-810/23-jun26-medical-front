import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  ArrowLeft,
  ChevronRight,
  PackageCheck,
  ScrollText,
} from "lucide-react-native";
import { useReceipts } from "@modules/inventory/hooks/useInventory";
import { ReceiptListItem } from "@modules/inventory/types";
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
} from "@shared/ui";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function ReceiptsScreen() {
  const navigation = useNavigation<any>();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const { data, isLoading, refetch, isRefetching } = useReceipts({
    page,
    limit,
  });
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
      render: (r) => (
        <Text variant="label" tone="primary">
          {r.receiptNo}
        </Text>
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
      overline="Stock Inward"
      title="Receipt history"
      subtitle={`${total.toLocaleString("en-IN")} goods-received notes`}
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={6}
        style={{ marginBottom: 16 }}
      >
        <HStack gap={6} align="center">
          <ArrowLeft size={18} color={palette.text.link} strokeWidth={2} />
          <Text variant="label" tone="link">
            Back to receive
          </Text>
        </HStack>
      </Pressable>

      {isLoading && receipts.length === 0 ? (
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
          <Text variant="label-lg" tone="primary">
            {receipt.receiptNo}
          </Text>
          <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
            {[
              receipt.supplierName || "No supplier",
              new Date(receipt.receivedAt).toLocaleDateString(),
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
