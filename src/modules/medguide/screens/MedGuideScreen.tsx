import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search } from "lucide-react-native";
import { medguideApi } from "@modules/medguide/api/medguideApi";
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
  EmptyState,
} from "@shared/ui";

export default function MedGuideScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Only query once something is typed. Browsing the whole catalogue page-by-page
  // is useless to a pharmacist AND would reveal how large the master list is.
  const term = search.trim();
  const active = term.length >= 2;
  const { data, isLoading } = useQuery({
    queryKey: ["medguide", term, page, limit],
    queryFn: () => medguideApi.search({ search: term, page, limit }),
    enabled: active,
  });
  const items = active ? (data?.data ?? []) : [];
  const meta = data?.meta;

  return (
    <Screen
      overline="MedGuide"
      title="Medicine guide"
      subtitle="Look up any medicine"
    >
      <View style={{ marginBottom: 12 }}>
        <TextField
          value={search}
          onChangeText={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name, salt or manufacturer"
          leading={
            <Search size={18} color={palette.text.tertiary} strokeWidth={1.8} />
          }
          autoCapitalize="none"
        />
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={
            !active
              ? "Search the medicine guide"
              : isLoading
                ? "Searching…"
                : "No medicine matches that search"
          }
          message={
            !active
              ? "Type a medicine name, salt or manufacturer to look it up."
              : undefined
          }
        />
      ) : (
        <VStack gap={8}>
          {items.map((m) => (
            <Card
              key={m._id}
              elevation="base"
              onPress={() =>
                navigation.navigate("MedicineDetail", { id: m._id })
              }
            >
              <HStack gap={10} align="center" justify="space-between">
                <VStack gap={2} flex={1}>
                  <Text variant="label-lg" tone="primary" numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
                    {m.saltComposition || "—"} · {m.manufacturerName || "—"}
                  </Text>
                </VStack>
                <VStack gap={4} align="flex-end">
                  <Text variant="label" weight="600" tone="secondary">
                    ₹{m.mrp}
                  </Text>
                  {m.prescriptionRequired ? (
                    <StatusChip label="Rx" tone="warning" />
                  ) : null}
                </VStack>
              </HStack>
            </Card>
          ))}
        </VStack>
      )}

      {/* Prev / Next only — never "x of N", so the catalogue size stays private. */}
      {items.length > 0 && (page > 1 || meta?.hasMore) ? (
        <HStack gap={10} justify="center" style={{ marginTop: 16 }}>
          <Button
            label="Previous"
            variant="secondary"
            fullWidth={false}
            disabled={page <= 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          />
          <Button
            label="Next"
            variant="secondary"
            fullWidth={false}
            disabled={!meta?.hasMore}
            onPress={() => setPage((p) => p + 1)}
          />
        </HStack>
      ) : null}
    </Screen>
  );
}
