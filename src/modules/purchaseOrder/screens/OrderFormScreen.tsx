import React, { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Plus, X, Search } from "lucide-react-native";
import { purchaseOrderApi } from "@modules/purchaseOrder/api/purchaseOrderApi";
import type { SeededLine } from "@modules/purchaseOrder/types";
import { useProducts } from "@modules/product/hooks/useProducts";
import { apiErrorMessage } from "@api/apiClient";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  TextField,
} from "@shared/ui";

interface Line {
  productId: string;
  productName: string;
  sku: string;
  quantity: string;
  estimatedPrice: string;
}

export default function OrderFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const seed = (route.params?.seedLines as SeededLine[] | undefined) ?? [];

  const [supplierName, setSupplierName] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>(
    seed.map((s) => ({
      productId: s.productId,
      productName: s.productName,
      sku: s.sku,
      quantity: String(s.quantity || 1),
      estimatedPrice: "",
    })),
  );
  const [search, setSearch] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: results } = useProducts({
    search: search || undefined,
    limit: 8,
  });

  const addProduct = (p: { id: string; name: string; sku: string }) => {
    if (lines.some((l) => l.productId === p.id)) return;
    setLines((s) => [
      ...s,
      {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        quantity: "1",
        estimatedPrice: "",
      },
    ]);
    setSearch("");
  };
  const setLine = (i: number, k: keyof Line, v: string) =>
    setLines((s) => s.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const removeLine = (i: number) =>
    setLines((s) => s.filter((_, idx) => idx !== i));

  const mut = useMutation({
    mutationFn: (status: "draft" | "placed") =>
      purchaseOrderApi.create({
        supplierName: supplierName.trim() || undefined,
        status,
        note: note.trim() || undefined,
        lines: lines
          .filter((l) => Number(l.quantity) > 0)
          .map((l) => ({
            productId: l.productId,
            quantity: Number(l.quantity),
            estimatedPrice: Number(l.estimatedPrice) || 0,
          })),
      }),
    onSuccess: () => navigation.goBack(),
    onError: (err) => setServerError(apiErrorMessage(err)),
  });

  const submit = (status: "draft" | "placed") => {
    setServerError(null);
    if (lines.filter((l) => Number(l.quantity) > 0).length === 0) {
      setServerError("Add at least one product with a quantity.");
      return;
    }
    mut.mutate(status);
  };

  return (
    <Screen
      overline="eOrders"
      title="New purchase order"
      right={
        <Button
          label="Back"
          size="sm"
          variant="secondary"
          icon={
            <ArrowLeft
              size={16}
              color={palette.text.secondary}
              strokeWidth={2}
            />
          }
          onPress={() => navigation.goBack()}
        />
      }
    >
      {serverError ? (
        <View style={styles.errorBox}>
          <Text variant="body-sm" tone="danger">
            {serverError}
          </Text>
        </View>
      ) : null}

      <Card style={{ marginBottom: 12 }}>
        <VStack gap={12}>
          <TextField
            label="Supplier / distributor"
            value={supplierName}
            onChangeText={setSupplierName}
            placeholder="Distributor name"
          />
          <View>
            <TextField
              label="Add product"
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or salt (c.paracetamol)"
              leading={
                <Search
                  size={18}
                  color={palette.text.tertiary}
                  strokeWidth={1.8}
                />
              }
              autoCapitalize="none"
            />
            {search.length > 0 ? (
              <Card style={{ marginTop: 6 }} padded={false}>
                {(results?.data ?? []).slice(0, 8).map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => addProduct(p)}
                    style={styles.result}
                  >
                    <Plus
                      size={14}
                      color={palette.teal[600]}
                      strokeWidth={2.2}
                    />
                    <Text variant="body-sm" tone="primary" numberOfLines={1}>
                      {p.name}
                    </Text>
                  </Pressable>
                ))}
              </Card>
            ) : null}
          </View>
        </VStack>
      </Card>

      <VStack gap={8}>
        {lines.map((l, i) => (
          <Card key={l.productId}>
            <HStack gap={10} align="center">
              <VStack gap={2} flex={1}>
                <Text variant="label-lg" tone="primary" numberOfLines={1}>
                  {l.productName}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {l.sku}
                </Text>
              </VStack>
              <View style={{ width: 66 }}>
                <TextField
                  value={l.quantity}
                  onChangeText={(v) => setLine(i, "quantity", v)}
                  keyboardType="number-pad"
                  placeholder="Qty"
                />
              </View>
              <View style={{ width: 74 }}>
                <TextField
                  value={l.estimatedPrice}
                  onChangeText={(v) => setLine(i, "estimatedPrice", v)}
                  keyboardType="numeric"
                  placeholder="₹/unit"
                />
              </View>
              <Pressable onPress={() => removeLine(i)} hitSlop={8}>
                <X size={18} color={palette.danger.text} strokeWidth={2} />
              </Pressable>
            </HStack>
          </Card>
        ))}
      </VStack>

      <Card style={{ marginTop: 12 }}>
        <TextField
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Delivery instructions…"
        />
      </Card>

      <HStack gap={10} style={{ marginTop: 16 }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Save draft"
            variant="secondary"
            loading={mut.isPending}
            onPress={() => submit("draft")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Place order"
            loading={mut.isPending}
            onPress={() => submit("placed")}
          />
        </View>
      </HStack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.danger.bg,
    borderWidth: 1,
    borderColor: palette.danger.border,
    marginBottom: 16,
  },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
});
