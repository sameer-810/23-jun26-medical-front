import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, Search, ShoppingBag } from "lucide-react-native";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { ShortbookItem } from "@modules/inventory/types";
import { palette } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
  TextField,
  Pagination,
  DataTable,
  Column,
  Skeleton,
} from "@shared/ui";

export default function ShortBookScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", "shortbook", search, page, limit],
    queryFn: () => inventoryApi.shortbook({ search, page, limit }),
  });

  const items = data?.data ?? [];
  const meta = data?.meta;

  const createOrder = () =>
    navigation.navigate("Orders", {
      screen: "OrderForm",
      params: {
        seedLines: items.map((it) => ({
          productId: it.productId,
          productName: it.name,
          sku: it.sku,
          quantity: it.suggested || it.need || 1,
        })),
      },
    });

  const columns: Column<ShortbookItem>[] = [
    {
      key: "name",
      header: "Product",
      width: 240,
      sortable: true,
      sortValue: (it) => it.name.toLowerCase(),
      render: (it) => (
        <VStack gap={2}>
          <Text variant="label" tone="primary" numberOfLines={1}>
            {it.name}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {it.brandName || "—"} · {it.sku}
          </Text>
        </VStack>
      ),
    },
    {
      key: "onHand",
      header: "Stock / Min",
      width: 130,
      align: "center",
      sortable: true,
      sortValue: (it) => it.onHand,
      render: (it) => (
        <Text variant="body-sm" tone="secondary">
          {it.onHand} / {it.reorderLevel}
        </Text>
      ),
    },
    {
      key: "velocity",
      header: "Sold · cover",
      width: 130,
      align: "center",
      sortable: true,
      sortValue: (it) => it.dailyVelocity,
      render: (it) =>
        it.sold30 > 0 ? (
          <VStack gap={1} align="center">
            <Text variant="body-sm" tone="secondary">
              {it.sold30}/mo
            </Text>
            {it.daysCover != null ? (
              <StatusChip
                label={`${it.daysCover}d left`}
                tone={it.daysCover <= 7 ? "danger" : "warning"}
              />
            ) : null}
          </VStack>
        ) : (
          <Text variant="caption" tone="tertiary">
            no recent sales
          </Text>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: 90,
      render: (it) => (
        <StatusChip
          label={it.onHand === 0 ? "Out" : "Low"}
          tone={it.onHand === 0 ? "danger" : "warning"}
        />
      ),
    },
    {
      key: "suggested",
      header: "Order",
      width: 96,
      align: "right",
      sortable: true,
      sortValue: (it) => it.suggested ?? it.need,
      render: (it) => (
        <VStack gap={0} align="flex-end">
          <Text variant="label-lg" weight="700" tone="primary">
            {it.suggested ?? it.need}
          </Text>
          {it.suggested != null && it.suggested !== it.need ? (
            <Text variant="caption" tone="tertiary">
              min {it.need}
            </Text>
          ) : null}
        </VStack>
      ),
    },
  ];

  return (
    <Screen
      overline="Inventory"
      title="ShortBook"
      subtitle="Items to reorder"
      right={
        items.length > 0 ? (
          <Button
            label="Create order"
            size="sm"
            icon={<ShoppingBag size={16} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={createOrder}
          />
        ) : undefined
      }
    >
      <View style={{ marginBottom: 12 }}>
        <TextField
          value={search}
          onChangeText={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search item, manufacturer"
          leading={
            <Search size={18} color={palette.text.tertiary} strokeWidth={1.8} />
          }
          autoCapitalize="none"
        />
      </View>

      {isLoading && items.length === 0 ? (
        <ListSkeleton />
      ) : (
        <>
          <DataTable<ShortbookItem>
            columns={columns}
            rows={items}
            keyExtractor={(it) => it.productId}
            mobileCard={(it) => <ShortBookRow item={it} />}
            emptyIcon={ListChecks}
            emptyTitle="Nothing to reorder"
          />
          {items.length > 0 && meta ? (
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
                label="items"
              />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function ShortBookRow({ item }: { item: ShortbookItem }) {
  return (
    <Card>
      <HStack gap={10} align="center" justify="space-between">
        <VStack gap={2} flex={1}>
          <Text variant="label-lg" tone="primary" numberOfLines={1}>
            {item.name}
          </Text>
          <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
            {item.brandName || "—"} · {item.sku}
          </Text>
        </VStack>
        <HStack gap={14} align="center">
          <VStack gap={1} align="flex-end">
            <Text variant="caption" tone="tertiary">
              Stock / Min
            </Text>
            <Text variant="body-sm" tone="secondary">
              {item.onHand} / {item.reorderLevel}
            </Text>
            {item.sold30 > 0 ? (
              <Text variant="caption" tone="tertiary">
                {item.sold30}/mo
                {item.daysCover != null ? ` · ${item.daysCover}d left` : ""}
              </Text>
            ) : null}
          </VStack>
          <StatusChip
            label={item.onHand === 0 ? "Out" : "Low"}
            tone={item.onHand === 0 ? "danger" : "warning"}
          />
          <VStack gap={1} align="flex-end" style={styles.orderCell}>
            <Text variant="caption" tone="tertiary">
              Order
            </Text>
            <Text variant="label-lg" weight="700" tone="primary">
              {item.suggested ?? item.need}
            </Text>
            {item.suggested != null && item.suggested !== item.need ? (
              <Text variant="caption" tone="tertiary">
                min {item.need}
              </Text>
            ) : null}
          </VStack>
        </HStack>
      </HStack>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <VStack gap={8}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <HStack gap={14} align="center">
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
  orderCell: {
    minWidth: 44,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: palette.border.subtle,
  },
});
