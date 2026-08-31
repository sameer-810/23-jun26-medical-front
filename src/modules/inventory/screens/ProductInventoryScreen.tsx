import React, { useState } from "react";
import { View, useWindowDimensions, DimensionValue } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  MapPin,
  CalendarClock,
  ScrollText,
  Repeat2,
  Receipt,
} from "lucide-react-native";
import { useProductInventory } from "@modules/inventory/hooks/useInventory";
import { PurchaseHistoryModal } from "@modules/inventory/components/PurchaseHistoryModal";
import { ProductBatchStock } from "@modules/inventory/types";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatTile,
  StatusChip,
  Skeleton,
  ErrorState,
} from "@shared/ui";
import { fmtMoneyExact, fmtDate } from "@shared/format";

const money = fmtMoneyExact;

function expiryInfo(iso: string | null): {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
} {
  if (!iso) return { label: "No expiry", tone: "neutral" };
  const d = new Date(iso);
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const date = fmtDate(iso);
  if (days < 0) return { label: `Expired ${date}`, tone: "danger" };
  if (days <= 30)
    return { label: `Expires ${date} (${days}d)`, tone: "danger" };
  if (days <= 90)
    return { label: `Expires ${date} (${days}d)`, tone: "warning" };
  return { label: `Expires ${date}`, tone: "success" };
}

export default function ProductInventoryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string;
  const { width } = useWindowDimensions();
  const cols = width >= 800 ? 4 : 2;
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useProductInventory(id);
  const [showPurchases, setShowPurchases] = useState(false);

  const tileW = `${100 / cols}%` as DimensionValue;

  if (isError) {
    return (
      <Screen back="Back to inventory" overline="Inventory" title="Product">
        <ErrorState
          error={error}
          title="This product isn't available"
          message="It may have been removed. Open Inventory to find it."
          actionLabel="Go to inventory"
          onAction={() => navigation.navigate("Inventory")}
        />
      </Screen>
    );
  }

  if (isLoading || !data) {
    return (
      <Screen back="Back to inventory" overline="Inventory" title="Product">
        <VStack gap={16}>
          <HStack gap={12} wrap>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ flexGrow: 1, flexBasis: 140 }}>
                <Skeleton height={72} />
              </View>
            ))}
          </HStack>
          {[0, 1].map((i) => (
            <Card key={i} elevation="base">
              <VStack gap={10}>
                <HStack justify="space-between">
                  <Skeleton width="40%" height={16} />
                  <Skeleton width={60} height={16} />
                </HStack>
                <Skeleton width="70%" height={14} />
                <Skeleton width="55%" height={14} />
              </VStack>
            </Card>
          ))}
        </VStack>
      </Screen>
    );
  }

  return (
    <Screen
      back="Back to inventory"
      overline="Inventory"
      title={data?.product.name || "Product"}
      subtitle={data?.product.sku}
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
      right={
        <HStack gap={8}>
          <Button
            label="Alternatives"
            size="sm"
            variant="secondary"
            icon={
              <Repeat2
                size={16}
                color={palette.text.secondary}
                strokeWidth={2}
              />
            }
            onPress={() =>
              navigation.navigate("Alternatives", {
                id,
                name: data?.product.name,
              })
            }
          />
          <Button
            label="Ledger"
            size="sm"
            variant="secondary"
            icon={
              <ScrollText
                size={16}
                color={palette.text.secondary}
                strokeWidth={2}
              />
            }
            onPress={() => navigation.navigate("ProductLedger", { id })}
          />
          <Button
            label="Purchases"
            size="sm"
            variant="secondary"
            icon={
              <Receipt
                size={16}
                color={palette.text.secondary}
                strokeWidth={2}
              />
            }
            onPress={() => setShowPurchases(true)}
          />
        </HStack>
      }
    >
      <PurchaseHistoryModal
        visible={showPurchases}
        productId={id}
        productName={data?.product.name}
        onClose={() => setShowPurchases(false)}
      />
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}
      >
        <View style={{ width: tileW, padding: 6 }}>
          <StatTile
            label={`On hand (${data?.product.baseUnit || ""})`}
            value={String(data?.summary.onHand ?? 0)}
            tone="teal"
          />
        </View>
        <View style={{ width: tileW, padding: 6 }}>
          <StatTile
            label="Available"
            value={String(data?.summary.available ?? 0)}
            tone="light"
          />
        </View>
        <View style={{ width: tileW, padding: 6 }}>
          <StatTile
            label="Stock value"
            value={money(data?.summary.stockValue ?? 0)}
            tone="light"
          />
        </View>
        <View style={{ width: tileW, padding: 6 }}>
          <StatTile
            label="Batches / locations"
            value={`${data?.summary.batches ?? 0} / ${data?.summary.locations ?? 0}`}
            tone="light"
          />
        </View>
      </View>

      <Text
        variant="h3"
        tone="primary"
        style={{ marginTop: 24, marginBottom: 12 }}
      >
        Batches (nearest expiry first — FEFO)
      </Text>
      <VStack gap={12}>
        {(data?.batches || []).map((b) => (
          <BatchCard key={b.batchId} batch={b} unit={data!.product.baseUnit} />
        ))}
        {!isLoading && (data?.batches || []).length === 0 && (
          <Text variant="body-sm" tone="tertiary">
            No stock on hand for this product.
          </Text>
        )}
      </VStack>
    </Screen>
  );
}

function BatchCard({
  batch,
  unit,
}: {
  batch: ProductBatchStock;
  unit: string;
}) {
  const exp = expiryInfo(batch.expiryDate);
  return (
    <Card elevation="base">
      <VStack gap={10}>
        <HStack align="center" justify="space-between" gap={8}>
          <HStack gap={8} align="center">
            <CalendarClock
              size={16}
              color={palette.text.tertiary}
              strokeWidth={1.9}
            />
            <Text variant="label-lg" tone="primary">
              {batch.batchNumber}
            </Text>
          </HStack>
          <Text variant="label-lg" tone="primary">
            {batch.onHand} {unit}
          </Text>
        </HStack>
        <HStack gap={6} wrap>
          <StatusChip label={exp.label} tone={exp.tone} />
          <StatusChip
            label={`${money(batch.purchasePrice)}/${unit} cost`}
            tone="neutral"
          />
        </HStack>
        <View
          style={{
            height: 1,
            backgroundColor: palette.border.subtle,
            marginVertical: 2,
          }}
        />
        {batch.locations.map((l) => (
          <HStack
            key={l.locationId}
            gap={8}
            align="center"
            justify="space-between"
          >
            <HStack gap={6} align="center" flex={1}>
              <MapPin size={14} color={palette.teal[600]} strokeWidth={1.9} />
              <Text variant="body-sm" tone="secondary" numberOfLines={1}>
                {l.path || l.code}
              </Text>
            </HStack>
            <View style={styles.codePill}>
              <Text variant="label-sm" tone="secondary">
                {l.code}
              </Text>
            </View>
            <Text variant="label" tone="primary">
              {l.quantity}
            </Text>
          </HStack>
        ))}
      </VStack>
    </Card>
  );
}

const styles = {
  codePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: palette.ink[100],
  },
} as const;
