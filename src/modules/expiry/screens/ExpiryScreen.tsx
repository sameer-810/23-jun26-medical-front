import React from "react";
import { View } from "react-native";
import { ShieldCheck, MapPin } from "lucide-react-native";
import { useExpiryReport } from "@modules/expiry/hooks/useExpiry";
import { ExpiryBatch } from "@modules/expiry/api/expiryApi";
import { palette, accents, numeric } from "@shared/designSystem";
import { fmtInt, fmtMoney } from "@shared/format";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  StatRow,
  SectionHeader,
  StatusChip,
  EmptyState,
  ErrorState,
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
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useExpiryReport();

  // Zero is a real count here, so with no report loaded the tiles show "—" and
  // the list is suppressed rather than falling through to the empty state.
  const missing = isError || (!data && !isLoading);
  const nothing = !isLoading && data && data.summary.total === 0;

  return (
    <Screen
      overline="Expiry Management"
      title="Expiry alerts"
      // Thresholds are per-organisation, so state them only once they arrive:
      // the default is a guess and would misreport a shop that changed them.
      subtitle={
        data?.thresholds
          ? `Thresholds: ${data.thresholds.join(" / ")} days · FEFO never sells expired`
          : "FEFO never sells expired"
      }
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
    >
      {missing ? (
        <ErrorState
          error={error}
          title="Couldn't load your expiry report"
          onRetry={() => refetch()}
          retrying={isRefetching}
          style={{ marginBottom: 10 }}
        />
      ) : null}

      {/* Tiles take an accent only when the count is above zero. */}
      <StatRow
        stats={[
          {
            label: "Expired",
            value: missing ? "—" : fmtInt(data?.summary.expired),
            accent:
              !missing && (data?.summary.expired ?? 0) > 0
                ? accents.red
                : undefined,
          },
          {
            label: "Expiring soon",
            value: missing ? "—" : fmtInt(data?.summary.expiringSoon),
            accent:
              !missing && (data?.summary.expiringSoon ?? 0) > 0
                ? accents.amber
                : undefined,
          },
          {
            label: "Value at risk",
            value: missing ? "—" : money(data?.summary.valueAtRisk ?? 0),
          },
        ]}
      />

      {isLoading && !data ? (
        <ListSkeleton />
      ) : missing ? null : nothing ? (
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
                items={b.items}
              />
            ))}
        </>
      )}
    </Screen>
  );
}

/**
 * A bucket of batches under its own heading.
 *
 * The heading used to end in a filled danger/warning/info chip carrying the
 * item count, which meant every section title dragged a coloured pill along
 * with it and the page read as three severities before you had read a word.
 * The title already says the severity ("Expired…", "Within 30 days"), and each
 * row still carries its own status chip, so the count is now just a count.
 */
function Section({ title, items }: { title: string; items: ExpiryBatch[] }) {
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
        <Text variant="label" tone="primary" style={numeric}>
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
    <View>
      <SectionHeader title={title} count={items.length} />
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
          <Text variant="label-lg" tone="primary" style={numeric}>
            {b.onHand} {b.baseUnit}
          </Text>
        </HStack>
        <HStack gap={6} wrap>
          <StatusChip label={batchStatusLabel(b)} tone={batchTone(b)} />
          <StatusChip label={`${money(b.stockValue)} at risk`} tone="neutral" />
          {b.locations.map((l, i) => (
            <View key={i} style={locPill}>
              <MapPin size={12} color={palette.text.tertiary} strokeWidth={2} />
              <Text variant="label-sm" tone="secondary" style={numeric}>
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

/**
 * Where the batch is sitting. Neutral, not brand green — a shelf code is a
 * location, and tinting it with the primary colour put the least urgent thing
 * on an expiry row in the loudest paint on the screen.
 */
const locPill = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 4,
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 999,
  backgroundColor: palette.surface.sunken,
};
