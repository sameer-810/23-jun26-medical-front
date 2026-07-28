import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, Search, ShoppingBag } from "lucide-react-native";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
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
  EmptyState,
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
          quantity: it.need || 1,
        })),
      },
    });

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

      {items.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={isLoading ? "Loading…" : "Nothing to reorder"}
        />
      ) : (
        <VStack gap={8}>
          {items.map((it) => (
            <Card key={it.productId}>
              <HStack gap={10} align="center" justify="space-between">
                <VStack gap={2} flex={1}>
                  <Text variant="label-lg" tone="primary" numberOfLines={1}>
                    {it.name}
                  </Text>
                  <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
                    {it.brandName || "—"} · {it.sku}
                  </Text>
                </VStack>
                <HStack gap={14} align="center">
                  <VStack gap={1} align="flex-end">
                    <Text variant="caption" tone="tertiary">
                      Stock / Min
                    </Text>
                    <Text variant="body-sm" tone="secondary">
                      {it.onHand} / {it.reorderLevel}
                    </Text>
                  </VStack>
                  <StatusChip
                    label={it.onHand === 0 ? "Out" : "Low"}
                    tone={it.onHand === 0 ? "danger" : "warning"}
                  />
                  <VStack gap={1} align="flex-end" style={styles.orderCell}>
                    <Text variant="caption" tone="tertiary">
                      Order
                    </Text>
                    <Text variant="label-lg" weight="700" tone="primary">
                      {it.need}
                    </Text>
                  </VStack>
                </HStack>
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
            label="items"
          />
        </View>
      ) : null}
    </Screen>
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
