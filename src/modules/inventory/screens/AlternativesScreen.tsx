import React, { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Repeat2 } from "lucide-react-native";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  StatusChip,
  EmptyState,
  Skeleton,
} from "@shared/ui";

type Sort = "expiry" | "price" | "margin";
const TABS: { key: Sort; label: string }[] = [
  { key: "expiry", label: "Nearest Expiry" },
  { key: "price", label: "Lowest Price" },
  { key: "margin", label: "Best Margin" },
];

export default function AlternativesScreen() {
  const route = useRoute<any>();
  const id = route.params?.id as string;
  const name = route.params?.name as string | undefined;
  const [sort, setSort] = useState<Sort>("expiry");

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", "alternatives", id, sort],
    queryFn: () => inventoryApi.alternatives(id, sort),
    enabled: Boolean(id),
  });

  const items = data?.items ?? [];

  if (isLoading || !data) {
    return (
      <Screen
        back="Back to product"
        overline="Alternatives"
        title={name || "Alternatives"}
      >
        <HStack gap={8} style={{ marginBottom: 14 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={110} height={34} rounded="full" />
          ))}
        </HStack>
        <VStack gap={8}>
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <HStack justify="space-between" align="center">
                <VStack gap={6} flex={1}>
                  <Skeleton width="60%" height={16} />
                  <Skeleton width="40%" height={12} />
                </VStack>
                <Skeleton width={54} height={16} />
              </HStack>
            </Card>
          ))}
        </VStack>
      </Screen>
    );
  }

  return (
    <Screen
      back="Back to product"
      overline="Alternatives"
      title={name || "Alternatives"}
      subtitle={data?.molecule ? `Same as ${data.molecule}` : undefined}
    >
      <HStack gap={8} style={{ marginBottom: 14 }}>
        {TABS.map((t) => {
          const on = t.key === sort;
          return (
            <Pressable
              key={t.key}
              onPress={() => setSort(t.key)}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Text
                variant="label"
                weight="600"
                style={{ color: on ? "#FFFFFF" : palette.text.secondary }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </HStack>

      {items.length === 0 ? (
        <EmptyState
          icon={Repeat2}
          title={isLoading ? "Loading…" : "No alternatives in stock"}
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
                    {it.brandName || "—"} · {it.saltComposition}
                  </Text>
                  {it.nearestExpiry ? (
                    <Text variant="caption" tone="tertiary">
                      Exp{" "}
                      {new Date(it.nearestExpiry).toLocaleDateString("en-IN")}
                    </Text>
                  ) : null}
                </VStack>
                <VStack gap={3} align="flex-end">
                  <Text variant="label-lg" weight="700" tone="primary">
                    ₹{it.mrp}
                  </Text>
                  <StatusChip
                    label={`Stock ${it.available}`}
                    tone={it.available > 0 ? "success" : "neutral"}
                  />
                  {sort === "margin" ? (
                    <Text variant="caption" tone="tertiary">
                      Margin ₹{Math.round(it.margin)}
                    </Text>
                  ) : null}
                </VStack>
              </HStack>
            </Card>
          ))}
        </VStack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.full,
    backgroundColor: palette.surface.primary,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  tabOn: { backgroundColor: palette.teal[700], borderColor: palette.teal[700] },
});
