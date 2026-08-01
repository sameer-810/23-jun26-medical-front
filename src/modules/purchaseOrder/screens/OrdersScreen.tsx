import React, { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Plus } from "lucide-react-native";
import { purchaseOrderApi } from "@modules/purchaseOrder/api/purchaseOrderApi";
import type { PoStatus, PurchaseOrder } from "@modules/purchaseOrder/types";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
  Pagination,
  DataTable,
  Column,
  Skeleton,
} from "@shared/ui";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const STATUS_TONE: Record<PoStatus, "neutral" | "info" | "success" | "danger"> =
  {
    draft: "neutral",
    placed: "info",
    received: "success",
    cancelled: "danger",
  };
const FILTERS: { key: PoStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "placed", label: "Placed" },
  { key: "received", label: "Received" },
];

export default function OrdersScreen() {
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<PoStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ["orders", filter, page, limit],
    queryFn: () =>
      purchaseOrderApi.list({
        status: filter === "all" ? undefined : filter,
        page,
        limit,
      }),
  });
  const orders = data?.data ?? [];
  const meta = data?.meta;

  const open = (o: PurchaseOrder) =>
    navigation.navigate("OrderDetail", { id: o._id });

  const columns: Column<PurchaseOrder>[] = [
    {
      key: "orderNo",
      header: "Order",
      width: 140,
      sortable: true,
      sortValue: (o) => o.orderNo,
      render: (o) => (
        <Text variant="label" tone="primary">
          {o.orderNo}
        </Text>
      ),
    },
    {
      key: "supplierName",
      header: "Supplier",
      width: 200,
      sortable: true,
      sortValue: (o) => (o.supplierName || "").toLowerCase(),
      render: (o) => (
        <Text variant="body-sm" tone="secondary" numberOfLines={1}>
          {o.supplierName || "No supplier"}
        </Text>
      ),
    },
    {
      key: "items",
      header: "Items",
      width: 80,
      align: "center",
      sortable: true,
      sortValue: (o) => o.lines.length,
      render: (o) => (
        <Text variant="body-sm" tone="secondary">
          {o.lines.length}
        </Text>
      ),
    },
    {
      key: "totalQuantity",
      header: "Units",
      width: 90,
      align: "center",
      sortable: true,
      sortValue: (o) => o.totalQuantity,
      render: (o) => (
        <Text variant="body-sm" tone="secondary">
          {o.totalQuantity}
        </Text>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 130,
      render: (o) => (
        <StatusChip label={o.status} tone={STATUS_TONE[o.status]} />
      ),
    },
    {
      key: "estimatedValue",
      header: "Total",
      width: 120,
      align: "right",
      sortable: true,
      sortValue: (o) => o.estimatedValue,
      render: (o) => (
        <Text variant="label" tone="primary">
          {money(o.estimatedValue)}
        </Text>
      ),
    },
  ];

  return (
    <Screen
      overline="eOrders"
      title="Purchase orders"
      right={
        <Button
          label="New order"
          size="sm"
          icon={<Plus size={16} color="#FFFFFF" strokeWidth={2.2} />}
          onPress={() => navigation.navigate("OrderForm", {})}
        />
      }
    >
      <HStack gap={8} style={{ marginBottom: 14, flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => {
                setFilter(f.key);
                setPage(1);
              }}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Text
                variant="label"
                weight="600"
                style={{ color: on ? "#FFFFFF" : palette.text.secondary }}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </HStack>

      {isLoading && orders.length === 0 ? (
        <ListSkeleton />
      ) : (
        <>
          <DataTable<PurchaseOrder>
            columns={columns}
            rows={orders}
            keyExtractor={(o) => o._id}
            onRowPress={open}
            mobileCard={(o) => <OrderRow order={o} onPress={() => open(o)} />}
            emptyIcon={ShoppingBag}
            emptyTitle="No orders yet"
          />
          {orders.length > 0 && meta ? (
            <View style={{ marginTop: 16 }}>
              <Pagination
                page={meta.page}
                totalPages={meta.pages}
                total={meta.total}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={(l) => {
                  setLimit(l);
                  setPage(1);
                }}
                label="orders"
              />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function OrderRow({
  order,
  onPress,
}: {
  order: PurchaseOrder;
  onPress: () => void;
}) {
  return (
    <Card elevation="base" onPress={onPress}>
      <HStack gap={10} align="center" justify="space-between">
        <VStack gap={2} flex={1}>
          <Text variant="label-lg" tone="primary">
            {order.orderNo}
          </Text>
          <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
            {order.supplierName || "No supplier"} · {order.lines.length} item
            {order.lines.length === 1 ? "" : "s"} · {order.totalQuantity} units
          </Text>
        </VStack>
        <VStack gap={4} align="flex-end">
          <Text variant="label-lg" tone="primary">
            {money(order.estimatedValue)}
          </Text>
          <StatusChip label={order.status} tone={STATUS_TONE[order.status]} />
        </VStack>
      </HStack>
    </Card>
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

const styles = StyleSheet.create({
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: palette.surface.primary,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  tabOn: { backgroundColor: palette.teal[700], borderColor: palette.teal[700] },
});
