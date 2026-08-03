import React, { useState, useEffect } from "react";
import { View, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search, ListPlus } from "lucide-react-native";
import { medguideApi } from "@modules/medguide/api/medguideApi";
import { Medicine } from "@modules/medguide/types";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { apiErrorMessage } from "@api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { palette, radius } from "@shared/designSystem";
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

  const canOrder = useAuthStore((s) => s.hasPermission)(
    PERMISSIONS.PRODUCTS_MANAGE,
  );
  const [adding, setAdding] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /**
   * Note that this medicine needs buying.
   *
   * Sends quantity 1 — a single "someone asked for this" signal. ShortBook
   * treats it as a reorder level, and asking again never lowers an existing
   * one, so a pharmacy that already keeps 50 isn't reset by one request.
   */
  const addToShortbook = async (m: Medicine) => {
    setAdding(m._id);
    setNote(null);
    try {
      const r = await inventoryApi.addToShortbook({
        catalogProductId: m._id,
        quantity: 1,
      });
      setNote(
        r.created
          ? `${r.product.name} added to your products and put on the ShortBook — need ${r.need}.`
          : `${r.product.name} is on the ShortBook — need ${r.need}.`,
      );
    } catch (e) {
      setNote(apiErrorMessage(e));
    } finally {
      setAdding(null);
    }
  };

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

      {note ? (
        <View style={styles.note}>
          <Text variant="body-sm" tone="secondary">
            {note}
          </Text>
        </View>
      ) : null}

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
                {/* The reason anyone looks a medicine up here is usually that a
                    customer asked for it and it wasn't on the shelf. This is
                    where that turns into a purchase note instead of a paper
                    chit — it works whether or not the pharmacy has ever
                    stocked the medicine. */}
                {canOrder ? (
                  <Pressable
                    onPress={() => void addToShortbook(m)}
                    disabled={adding === m._id}
                    hitSlop={8}
                    style={styles.shortbookBtn}
                    accessibilityLabel={`Add ${m.name} to ShortBook`}
                  >
                    {adding === m._id ? (
                      <ActivityIndicator
                        size="small"
                        color={palette.teal[700]}
                      />
                    ) : (
                      <HStack gap={5} align="center">
                        <ListPlus
                          size={15}
                          color={palette.teal[700]}
                          strokeWidth={2}
                        />
                        <Text
                          variant="label-sm"
                          style={{ color: palette.teal[700] }}
                        >
                          ShortBook
                        </Text>
                      </HStack>
                    )}
                  </Pressable>
                ) : null}
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

const styles = StyleSheet.create({
  shortbookBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.teal[700],
    marginLeft: 10,
    minWidth: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    marginBottom: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.teal[50],
  },
});
