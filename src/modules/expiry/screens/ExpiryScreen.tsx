import React from "react";
import { View, useWindowDimensions } from "react-native";
import {
  AlarmClock,
  CalendarX2,
  ShieldCheck,
  MapPin,
} from "lucide-react-native";
import { useExpiryReport } from "@modules/expiry/hooks/useExpiry";
import { ExpiryBatch } from "@modules/expiry/api/expiryApi";
import { palette, accents } from "@shared/designSystem";
import { fmtInt, fmtMoney } from "@shared/format";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  StatTile,
  StatusChip,
  EmptyState,
  DataTable,
  Column,
  Skeleton,
} from "@shared/ui";

const money = fmtMoney;

const batchTone = (b: ExpiryBatch) =>
  b.expired || b.daysToExpiry <= 30
    ? "danger"
    : b.daysToExpiry <= 60
      ? "warning"
      : "info";

const batchStatusLabel = (b: ExpiryBatch) =>
  b.expired
    ? `Expired ${b.expiryDate.slice(0, 10)}`
    : `${b.daysToExpiry}d · ${b.expiryDate.slice(0, 10)}`;

export default function ExpiryScreen() {
  const { width } = useWindowDimensions();
  const cols = width >= 800 ? 3 : 1;
  const tileW = cols === 1 ? "100%" : "33.33%";
  const { data, isLoading, refetch, isRefetching } = useExpiryReport();

  const nothing = !isLoading && data && data.summary.total === 0;

  return (
    <Screen
      overline="Expiry Management"
      title="Expiry alerts"
      subtitle={`Thresholds: ${(data?.thresholds || [90, 60, 30]).join(" / ")} days · FEFO never sells expired`}
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
    >
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}
      >
        <View style={{ width: tileW, padding: 6 }}>
          <StatTile
            label="Expired"
            value={fmtInt(data?.summary.expired)}
            icon={CalendarX2}
            accent={accents.red}
          />
        </View>
        <View style={{ width: tileW, padding: 6 }}>
          <StatTile
            label="Expiring soon"
            value={fmtInt(data?.summary.expiringSoon)}
            icon={AlarmClock}
            accent={accents.amber}
          />
        </View>
        <View style={{ width: tileW, padding: 6 }}>
          <StatTile
            label="Value at risk"
            value={money(data?.summary.valueAtRisk ?? 0)}
            tone="teal"
          />
        </View>
      </View>

      {isLoading && !data ? (
        <ListSkeleton />
      ) : nothing ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing expiring"
          message="No stock is expired or within your alert window."
        />
      ) : (
        <>
          {(data?.expired.length ?? 0) > 0 && (
            <Section
              title="Expired — remove from sellable stock"
              tone="danger"
              items={data!.expired}
            />
          )}
          {(data?.buckets || [])
            .filter((b) => b.items.length > 0)
            .sort((a, b) => a.days - b.days)
            .map((b) => (
              <Section
                key={b.days}
                title={`Within ${b.days} days`}
                tone={
                  b.days <= 30 ? "danger" : b.days <= 60 ? "warning" : "info"
                }
                items={b.items}
              />
            ))}
        </>
      )}
    </Screen>
  );
}

function Section({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "danger" | "warning" | "info";
  items: ExpiryBatch[];
}) {
  const columns: Column<ExpiryBatch>[] = [
    {
      key: "productName",
      header: "Product",
      width: 240,
      sortable: true,
      sortValue: (b) => b.productName.toLowerCase(),
      render: (b) => (
        <VStack gap={2}>
          <Text variant="label" tone="primary" numberOfLines={1}>
            {b.productName}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {b.sku}
          </Text>
        </VStack>
      ),
    },
    {
      key: "batchNumber",
      header: "Batch",
      width: 130,
      render: (b) => (
        <Text variant="body-sm" tone="secondary" numberOfLines={1}>
          {b.batchNumber}
        </Text>
      ),
    },
    {
      key: "expiryDate",
      header: "Expiry",
      width: 130,
      sortable: true,
      sortValue: (b) => b.expiryDate,
      render: (b) => (
        <Text variant="body-sm" tone="tertiary">
          {b.expiryDate.slice(0, 10)}
        </Text>
      ),
    },
    {
      key: "onHand",
      header: "Qty",
      width: 110,
      align: "right",
      sortable: true,
      sortValue: (b) => b.onHand,
      render: (b) => (
        <Text variant="label" tone="primary">
          {b.onHand} {b.baseUnit}
        </Text>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 180,
      render: (b) => (
        <StatusChip label={batchStatusLabel(b)} tone={batchTone(b)} />
      ),
    },
  ];

  return (
    <View style={{ marginTop: 24 }}>
      <HStack gap={8} align="center" style={{ marginBottom: 12 }}>
        <Text variant="h3" tone="primary">
          {title}
        </Text>
        <StatusChip label={String(items.length)} tone={tone} />
      </HStack>
      <DataTable<ExpiryBatch>
        columns={columns}
        rows={items}
        keyExtractor={(b) => b.batchId}
        mobileCard={(b) => <ExpiryRow batch={b} />}
      />
    </View>
  );
}

function ExpiryRow({ batch: b }: { batch: ExpiryBatch }) {
  return (
    <Card elevation="base">
      <VStack gap={8}>
        <HStack align="center" justify="space-between">
          <VStack gap={2} flex={1}>
            <Text variant="label-lg" tone="primary" numberOfLines={1}>
              {b.productName}
            </Text>
            <Text variant="caption" tone="tertiary">
              {b.sku} · batch {b.batchNumber}
            </Text>
          </VStack>
          <Text variant="label-lg" tone="primary">
            {b.onHand} {b.baseUnit}
          </Text>
        </HStack>
        <HStack gap={6} wrap>
          <StatusChip label={batchStatusLabel(b)} tone={batchTone(b)} />
          <StatusChip label={`${money(b.stockValue)} at risk`} tone="neutral" />
          {b.locations.map((l, i) => (
            <View key={i} style={locPill}>
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

function ListSkeleton() {
  return (
    <VStack gap={12} style={{ marginTop: 24 }}>
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

const locPill = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 4,
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 999,
  backgroundColor: palette.teal[50],
};
