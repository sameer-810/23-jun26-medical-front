import React, { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Plus } from "lucide-react-native";
import { purchaseOrderApi } from "@modules/purchaseOrder/api/purchaseOrderApi";
import type { PoStatus } from "@modules/purchaseOrder/types";
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
  EmptyState,
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

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={isLoading ? "Loading…" : "No orders yet"}
        />
      ) : (
        <VStack gap={10}>
          {orders.map((o) => (
            <Card
              key={o._id}
              elevation="base"
              onPress={() => navigation.navigate("OrderDetail", { id: o._id })}
            >
              <HStack gap={10} align="center" justify="space-between">
                <VStack gap={2} flex={1}>
                  <Text variant="label-lg" tone="primary">
                    {o.orderNo}
                  </Text>
                  <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
                    {o.supplierName || "No supplier"} · {o.lines.length} item
                    {o.lines.length === 1 ? "" : "s"} · {o.totalQuantity} units
                  </Text>
                </VStack>
                <VStack gap={4} align="flex-end">
                  <Text variant="label-lg" tone="primary">
                    {money(o.estimatedValue)}
                  </Text>
                  <StatusChip label={o.status} tone={STATUS_TONE[o.status]} />
                </VStack>
              </HStack>
            </Card>
          ))}
        </VStack>
      )}

      {meta && meta.total > 0 ? (
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
    </Screen>
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
  tabOn: { backgroundColor: palette.teal[600], borderColor: palette.teal[600] },
});
