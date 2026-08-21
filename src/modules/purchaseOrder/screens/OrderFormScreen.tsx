import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Search, PackageSearch } from "lucide-react-native";
import { purchaseOrderApi } from "@modules/purchaseOrder/api/purchaseOrderApi";
import type { SeededLine } from "@modules/purchaseOrder/types";
import { useProducts } from "@modules/product/hooks/useProducts";
import { apiErrorMessage } from "@api/apiClient";
import { fmtMoney } from "@shared/format";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  HStack,
  Card,
  Button,
  TextField,
  Combobox,
  Banner,
  EmptyState,
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

  // Debounced: one request per pause, not per keystroke, and out-of-order
  // replies can't leave a stale list on screen.
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const { data: results, isFetching } = useProducts({
    search: term || undefined,
    limit: 8,
  });
  const productsLoading = isFetching || search.trim() !== term;

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

  const qc = useQueryClient();
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
    onSuccess: () => {
      // The list screen stays mounted behind this form and focus-refetch is off
      // globally, so without this the new order simply is not there when the
      // form closes. It reads as a failed save, and the natural response is to
      // key the whole order again — which is how a distributor ends up
      // receiving the same 12-line order twice.
      qc.invalidateQueries({ queryKey: ["orders"] });
      navigation.goBack();
    },
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
    <Screen back="Back to orders" overline="eOrders" title="New purchase order">
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

      {lines.length === 0 ? (
        <Card>
          <EmptyState
            icon={PackageSearch}
            title="No items yet"
            message="Search a medicine above to add it to this order."
          />
        </Card>
      ) : (
        <Card padded={false} style={{ overflow: "hidden" }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ minWidth: "100%" }}
          >
            <View style={{ minWidth: "100%" }}>
              <View style={pog.head}>
                <PoHead w={POC.idx} label="#" />
                <PoHead w={POC.product} label="PRODUCT" left />
                <PoHead w={POC.qty} label="QTY" />
                <PoHead w={POC.price} label="EST ₹/UNIT" right />
                <PoHead w={POC.amount} label="AMOUNT" right />
                <View style={{ width: POC.rm }} />
              </View>
              {lines.map((l, i) => {
                const amt =
                  (Number(l.quantity) || 0) * (Number(l.estimatedPrice) || 0);
                return (
                  <View
                    key={l.productId}
                    style={[
                      pog.row,
                      i % 2 === 1 ? { backgroundColor: palette.ink[50] } : null,
                    ]}
                  >
                    <Text
                      style={{ width: POC.idx, textAlign: "center" }}
                      variant="caption"
                      tone="tertiary"
                    >
                      {i + 1}
                    </Text>
                    <View style={{ width: POC.product }}>
                      <Text variant="body-sm" tone="primary" numberOfLines={1}>
                        {l.productName}
                      </Text>
                      <Text variant="caption" tone="tertiary" numberOfLines={1}>
                        {l.sku}
                      </Text>
                    </View>
                    <PoCell
                      w={POC.qty}
                      value={l.quantity}
                      onChangeText={(v) => setLine(i, "quantity", v)}
                      align="center"
                    />
                    <PoCell
                      w={POC.price}
                      value={l.estimatedPrice}
                      onChangeText={(v) => setLine(i, "estimatedPrice", v)}
                      align="right"
                    />
                    <Text
                      style={{ width: POC.amount, textAlign: "right" }}
                      variant="label-sm"
                      tone="primary"
                    >
                      {amt > 0 ? fmtMoney(amt) : "—"}
                    </Text>
                    <Pressable
                      onPress={() => removeLine(i)}
                      style={{ width: POC.rm, alignItems: "center" }}
                      accessibilityRole="button"
                      accessibilityLabel="Remove line"
                    >
                      <X
                        size={15}
                        color={palette.text.tertiary}
                        strokeWidth={2}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </Card>
      )}

      <Card style={{ marginTop: 12 }}>
        <TextField
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Delivery instructions…"
        />
      </Card>

      {/* Right-aligned on desktop: a pair of half-page-wide bars is a phone
          pattern, and the commit button belongs at the end of the form. */}
      <HStack gap={8} justify="flex-end" style={{ marginTop: 14 }}>
        <Button
          label="Save draft"
          variant="secondary"
          size="md"
          fullWidth={false}
          loading={mut.isPending}
          onPress={() => submit("draft")}
        />
        <Button
          label="Place order"
          size="md"
          fullWidth={false}
          loading={mut.isPending}
          onPress={() => submit("placed")}
        />
      </HStack>
    </Screen>
  );
}

// ---- PO line grid ----
const POC = { idx: 26, product: 240, qty: 64, price: 96, amount: 96, rm: 30 };

function PoHead({
  w,
  label,
  left,
  right,
}: {
  w: number;
  label: string;
  left?: boolean;
  right?: boolean;
}) {
  return (
    <Text
      style={{
        width: w,
        textAlign: left ? "left" : right ? "right" : "center",
      }}
      variant="overline"
      tone="tertiary"
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}

function PoCell({
  w,
  value,
  onChangeText,
  align = "left",
}: {
  w: number;
  value: string;
  onChangeText: (v: string) => void;
  align?: "left" | "center" | "right";
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType="decimal-pad"
      selectTextOnFocus
      style={[
        pog.cell,
        { width: w, textAlign: align },
        // @ts-expect-error web-only outline reset
        { outlineStyle: "none" },
      ]}
    />
  );
}

const pog = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.neutral[50],
    borderBottomWidth: 1.5,
    borderBottomColor: palette.border.strong,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
  cell: {
    height: 38,
    borderWidth: 1,
    borderColor: palette.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    fontSize: 13,
    color: palette.text.primary,
    backgroundColor: palette.surface.primary,
  },
});
