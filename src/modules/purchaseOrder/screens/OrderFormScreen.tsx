import React, { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, X, Search } from "lucide-react-native";
import { purchaseOrderApi } from "@modules/purchaseOrder/api/purchaseOrderApi";
import type { SeededLine } from "@modules/purchaseOrder/types";
import { useProducts } from "@modules/product/hooks/useProducts";
import { apiErrorMessage } from "@api/apiClient";
import { palette } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  TextField,
  Combobox,
  Banner,
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

  const { data: results, isFetching: productsLoading } = useProducts({
    search: search || undefined,
    limit: 8,
  });

  const productsById = useMemo(() => {
    const map: Record<string, { id: string; name: string; sku: string }> = {};
    for (const p of results?.data ?? [])
      map[p.id] = { id: p.id, name: p.name, sku: p.sku };
    return map;
  }, [results]);

  const productItems = useMemo(
    () =>
      (results?.data ?? []).map((p) => ({
        value: p.id,
        label: p.name,
        sublabel: p.sku,
      })),
    [results],
  );

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
        <Banner
          tone="danger"
          message={serverError}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Card style={{ marginBottom: 12 }}>
        <TextField
          label="Supplier / distributor"
          value={supplierName}
          onChangeText={setSupplierName}
          placeholder="Distributor name"
        />
      </Card>

      <View style={{ marginBottom: 12, zIndex: 20 }}>
        <Combobox
          placeholder="Search by name or salt (c.paracetamol) to add a line"
          query={search}
          onQueryChange={setSearch}
          items={productItems}
          loading={productsLoading}
          onSelect={(id) => {
            const p = productsById[id];
            if (p) addProduct(p);
          }}
          leading={
            <Search size={18} color={palette.teal[600]} strokeWidth={2} />
          }
          emptyText="No match — type the full name"
        />
      </View>

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
