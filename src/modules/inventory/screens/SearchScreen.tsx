import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { PackageSearch, MapPin, CalendarClock } from "lucide-react-native";
import { useSectionNav } from "@navigation/AppNavigator";
import { useInventorySearch } from "@modules/inventory/hooks/useInventory";
import { StockSummaryItem, SearchBatchResult } from "@modules/inventory/types";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  StatusChip,
  ChipsRow,
  SearchInput,
  EmptyState,
} from "@shared/ui";
import { fmtDate } from "@shared/format";

const EXP_FILTERS = [
  { key: "0", label: "Any expiry" },
  { key: "30", label: "≤ 30 days" },
  { key: "60", label: "≤ 60 days" },
  { key: "90", label: "≤ 90 days" },
];

function expiryTone(
  iso: string | null,
): "success" | "warning" | "danger" | "neutral" {
  if (!iso) return "neutral";
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return "danger";
  if (days <= 30) return "danger";
  if (days <= 90) return "warning";
  return "success";
}

export default function SearchScreen() {
  const go = useSectionNav();
  const [q, setQ] = useState("");
  const [exp, setExp] = useState("0");

  const expiringInDays = exp === "0" ? undefined : Number(exp);
  const enabled = q.trim().length > 0 || expiringInDays !== undefined;
  const { data, isFetching } = useInventorySearch(
    { q: q.trim() || undefined, expiringInDays },
    enabled,
  );

  const products = data?.products ?? [];
  const batches = data?.batches ?? [];

  return (
    <Screen
      overline="Search"
      title="Product search"
      subtitle="By name, SKU, barcode, batch or expiry — with exact locations"
    >
      <SearchInput
        value={q}
        onChangeText={setQ}
        placeholder="Name, SKU, barcode or batch number"
        autoFocus
      />
      <View style={{ marginHorizontal: -24, marginTop: 12 }}>
        <ChipsRow chips={EXP_FILTERS} active={exp} onChange={setExp} />
      </View>

      {!enabled ? (
        <EmptyState
          icon={PackageSearch}
          title="Start typing to search"
          message="Find stock by product, batch number or upcoming expiry."
        />
      ) : products.length === 0 && batches.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={isFetching ? "Searching…" : "No matches"}
          message="Try a different term or expiry window."
        />
      ) : (
        <VStack gap={24} style={{ marginTop: 16 }}>
          {products.length > 0 && (
            <VStack gap={12}>
              <Text variant="overline" tone="tertiary">
                Products ({products.length})
              </Text>
              {products.map((p) => (
                <ProductResult
                  key={p.productId}
                  item={p}
                  onPress={() => go("Inventory")}
                />
              ))}
            </VStack>
          )}
          {batches.length > 0 && (
            <VStack gap={12}>
              <Text variant="overline" tone="tertiary">
                Batches ({batches.length})
              </Text>
              {batches.map((b) => (
                <BatchResult key={b.batchId} batch={b} />
              ))}
            </VStack>
          )}
        </VStack>
      )}
    </Screen>
  );
}

function ProductResult({
  item,
  onPress,
}: {
  item: StockSummaryItem;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} elevation="base">
      <HStack gap={12} align="center">
        <PackageSearch size={20} color={palette.teal[600]} strokeWidth={1.9} />
        <VStack gap={3} flex={1}>
          <Text variant="label-lg" tone="primary" numberOfLines={1}>
            {item.name}
          </Text>
          <Text variant="body-sm" tone="tertiary">
            {item.sku}
            {item.barcode ? ` · ${item.barcode}` : ""}
          </Text>
        </VStack>
        <StatusChip label={`${item.available} ${item.baseUnit}`} tone="info" />
      </HStack>
    </Card>
  );
}

function BatchResult({ batch }: { batch: SearchBatchResult }) {
  return (
    <Card elevation="base">
      <VStack gap={8}>
        <HStack align="center" justify="space-between">
          <VStack gap={2} flex={1}>
            <Text variant="label-lg" tone="primary" numberOfLines={1}>
              {batch.productName}
            </Text>
            <HStack gap={6} align="center">
              <CalendarClock
                size={13}
                color={palette.text.tertiary}
                strokeWidth={1.9}
              />
              <Text variant="caption" tone="tertiary">
                {batch.sku} · batch {batch.batchNumber}
              </Text>
            </HStack>
          </VStack>
          <Text variant="label-lg" tone="primary">
            {batch.onHand} {batch.baseUnit}
          </Text>
        </HStack>
        <HStack gap={6} wrap>
          <StatusChip
            label={
              batch.expiryDate
                ? `exp ${fmtDate(batch.expiryDate)}`
                : "no expiry"
            }
            tone={expiryTone(batch.expiryDate)}
          />
          {batch.locations.map((l, i) => (
            <View key={i} style={styles.locPill}>
              <MapPin size={12} color={palette.teal[600]} strokeWidth={2} />
              <Text variant="label-sm" tone="secondary">
                {l.code} · {l.quantity}
              </Text>
            </View>
          ))}
        </HStack>
      </VStack>
    </Card>
  );
}

const styles = StyleSheet.create({
  locPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: palette.teal[50],
  },
});
