import React, { useState, useEffect } from "react";
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

/** Below this a lookup matches most of the catalogue — it isn't a search yet. */
const MIN_CHARS = 2;
const LIMIT = 20;

export default function MedGuideScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  // Debounce. Typing "paracetamol" used to fire eleven searches over a 254k-row
  // catalogue, each one a full scan, arriving out of order — so the list you
  // ended up looking at was whichever reply happened to land last.
  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const ready = term.length >= MIN_CHARS;
  const { data, isFetching } = useQuery({
    queryKey: ["medguide", term, page],
    queryFn: () => medguideApi.search({ search: term, page, limit: LIMIT }),
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  });
  const items = data?.data ?? [];
  const hasMore = data?.meta?.hasMore ?? false;
  // The debounce gap counts as searching — otherwise the screen flashes "no
  // medicine matches" in the pause between the last keystroke and the request.
  const searching =
    isFetching || (search.trim() !== term && search.trim().length >= MIN_CHARS);

  return (
    <Screen
      overline="MedGuide"
      title="Medicine guide"
      subtitle="Look up any medicine"
    >
      <View style={{ marginBottom: 12 }}>
        <TextField
          value={search}
          onChangeText={setSearch}
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
            searching
              ? "Searching…"
              : ready
                ? "No medicine matches that"
                : "Search the medicine guide"
          }
          message={
            !searching && !ready
              ? `Type at least ${MIN_CHARS} letters of a brand, salt or manufacturer.`
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

      {/* Prev/Next, not "page 3 of 412" — there's no total to page against any
          more, and a lookup is something you refine rather than paginate. */}
      {items.length > 0 && (page > 1 || hasMore) ? (
        <HStack gap={10} justify="center" style={{ marginTop: 16 }}>
          <Button
            label="Previous"
            variant="secondary"
            fullWidth={false}
            disabled={page === 1 || searching}
            onPress={() => setPage((n) => Math.max(1, n - 1))}
          />
          <Button
            label="Next"
            variant="secondary"
            fullWidth={false}
            disabled={!hasMore || searching}
            onPress={() => setPage((n) => n + 1)}
          />
        </HStack>
      ) : null}
    </Screen>
  );
}
