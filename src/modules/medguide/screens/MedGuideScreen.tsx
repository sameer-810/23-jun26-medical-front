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
  StatusChip,
  TextField,
  Pagination,
  EmptyState,
} from "@shared/ui";

export default function MedGuideScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ["medguide", search, page, limit],
    queryFn: () => medguideApi.search({ search, page, limit }),
  });
  const items = data?.data ?? [];
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
          title={isLoading ? "Loading…" : "Search the medicine guide"}
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
            label="medicines"
          />
        </View>
      ) : null}
    </Screen>
  );
}
