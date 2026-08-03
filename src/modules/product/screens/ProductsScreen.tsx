import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Package,
  ChevronRight,
  Pill,
  BookOpen,
} from "lucide-react-native";
import { useProducts, useCategories } from "@modules/product/hooks/useProducts";
import { ProductListItem } from "@modules/product/types";
import { medguideApi } from "@modules/medguide/api/medguideApi";
import { Medicine } from "@modules/medguide/types";
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
  ChipsRow,
  SearchInput,
  EmptyState,
  Pagination,
} from "@shared/ui";

/** Below this the catalogue matches too much to be a useful suggestion. */
const CATALOG_MIN_CHARS = 2;

export default function ProductsScreen() {
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission(PERMISSIONS.PRODUCTS_MANAGE);
  // MedGuide has no sidebar row; it opens from here. Gated on the permission
  // its nav entry carries so the button can't point at an unregistered route.
  const canOpenMedGuide = hasPermission(PERMISSIONS.DASHBOARD_VIEW);
  const [adding, setAdding] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Debounce: the catalogue can hold tens of thousands of rows, so don't fire a
  // server search on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Any change to the filters puts you back on page 1. Adjusted during render
  // (React's documented pattern) rather than in an effect, which would cost an
  // extra render pass and fetch the wrong page first.
  const filterKey = `${debouncedSearch}|${categoryId}|${limit}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const { data: categories } = useCategories();
  const params: {
    search?: string;
    categoryId?: string;
    page: number;
    limit: number;
  } = { page, limit };
  if (debouncedSearch) params.search = debouncedSearch;
  if (categoryId !== "all") params.categoryId = categoryId;

  const { data, isLoading, refetch, isRefetching } = useProducts(params);

  const products = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.pages ?? 1;

  // Snap back if the result set shrank below the current page.
  if (!isLoading && totalPages > 0 && page > totalPages) setPage(totalPages);

  const categoryChips = [
    { key: "all", label: "All" },
    ...(categories || []).map((c) => ({ key: c.id, label: c.name })),
  ];

  /**
   * The global medicine catalogue, searched alongside your own products.
   *
   * Same shape Amazon Seller Central uses: you don't browse the master
   * catalogue as a destination, you search it from inside the add flow and
   * claim the match ("Sell this product"). Stocking something for the first
   * time shouldn't mean retyping a name, pack, MRP, GST and HSN the platform
   * already knows.
   */
  const { data: catalogHits, isFetching: catalogLoading } = useQuery({
    queryKey: ["products-catalog", debouncedSearch],
    queryFn: () => medguideApi.search({ search: debouncedSearch, limit: 8 }),
    enabled: canManage && debouncedSearch.length >= CATALOG_MIN_CHARS,
    staleTime: 5 * 60 * 1000,
  });

  // Only offer what this pharmacy doesn't already carry.
  const mySkus = new Set(products.map((p) => p.sku));
  const catalogSuggestions = (catalogHits?.data ?? []).filter(
    (m) => !mySkus.has(m.sku),
  );

  const addFromCatalog = async (m: Medicine) => {
    setAdding(m._id);
    setNote(null);
    try {
      await medguideApi.addToStore(m._id);
      await qc.invalidateQueries({ queryKey: ["products"] });
      setNote(`${m.name} added to your products.`);
    } catch (e: any) {
      setNote(
        e?.response?.data?.message || `Couldn't add ${m.name}. Try again.`,
      );
    } finally {
      setAdding(null);
    }
  };

  return (
    <Screen
      overline="Catalogue"
      title="Products"
      subtitle={`${total.toLocaleString("en-IN")} products`}
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
      right={
        canManage || canOpenMedGuide ? (
          <HStack gap={10} align="center">
            {canOpenMedGuide && (
              <Button
                label="MedGuide"
                variant="secondary"
                fullWidth={false}
                icon={
                  <BookOpen
                    size={18}
                    color={palette.text.primary}
                    strokeWidth={1.9}
                  />
                }
                onPress={() => navigation.navigate("MedGuide")}
              />
            )}
            {canManage && (
              <Button
                label="Add product"
                fullWidth={false}
                icon={<Plus size={18} color="#FFFFFF" strokeWidth={2.2} />}
                onPress={() => navigation.navigate("ProductForm")}
              />
            )}
          </HStack>
        ) : undefined
      }
    >
      <SearchInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search name, SKU, barcode, HSN"
      />

      {categoryChips.length > 1 && (
        <View style={{ marginHorizontal: -24, marginTop: 12 }}>
          <ChipsRow
            chips={categoryChips}
            active={categoryId}
            onChange={setCategoryId}
          />
        </View>
      )}

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={isLoading ? "Loading…" : "No products yet"}
          message="Add your first product to start building the catalogue."
          action={
            canManage ? (
              <Button
                label="Add product"
                fullWidth={false}
                onPress={() => navigation.navigate("ProductForm")}
              />
            ) : undefined
          }
        />
      ) : (
        <VStack gap={12} style={{ marginTop: 16 }}>
          {products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              onPress={() => navigation.navigate("ProductForm", { id: p.id })}
            />
          ))}

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={setLimit}
            label="products"
          />
        </VStack>
      )}

      {note ? (
        <View style={styles.note}>
          <Text variant="body-sm" tone="secondary">
            {note}
          </Text>
        </View>
      ) : null}

      {canManage && debouncedSearch.length >= CATALOG_MIN_CHARS ? (
        <View style={{ marginTop: 22 }}>
          <HStack gap={8} align="center" style={{ marginBottom: 10 }}>
            <Text variant="label-sm" tone="tertiary">
              FROM THE MEDICINE CATALOGUE
            </Text>
            {catalogLoading ? (
              <ActivityIndicator size="small" color={palette.teal[600]} />
            ) : null}
          </HStack>
          {catalogSuggestions.length === 0 ? (
            <Text variant="body-sm" tone="tertiary">
              {catalogLoading
                ? "Looking…"
                : "Nothing else in the catalogue matches that."}
            </Text>
          ) : (
            <VStack gap={8}>
              {catalogSuggestions.map((m) => (
                <CatalogRow
                  key={m._id}
                  medicine={m}
                  busy={adding === m._id}
                  onAdd={() => addFromCatalog(m)}
                />
              ))}
            </VStack>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

/**
 * A medicine we don't stock yet. One tap copies the platform's record — name,
 * SKU, salt, brand, pack unit and factor, MRP, GST, HSN, Rx flag — into this
 * pharmacy's own products, so nothing has to be typed.
 */
function CatalogRow({
  medicine,
  busy,
  onAdd,
}: {
  medicine: Medicine;
  busy: boolean;
  onAdd: () => void;
}) {
  return (
    <Card elevation="base">
      <HStack gap={12} align="center">
        <View style={[styles.icon, { backgroundColor: palette.ink[50] }]}>
          <Package size={20} color={palette.text.tertiary} strokeWidth={1.9} />
        </View>
        <VStack gap={4} flex={1}>
          <HStack gap={8} align="center">
            <Text variant="label-lg" tone="primary" numberOfLines={1}>
              {medicine.name}
            </Text>
            {medicine.prescriptionRequired && (
              <Pill size={14} color={palette.danger.text} strokeWidth={2} />
            )}
          </HStack>
          <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
            {[medicine.saltComposition, medicine.manufacturerName]
              .filter(Boolean)
              .join("  ·  ") || "—"}
          </Text>
          <HStack gap={6} wrap>
            <StatusChip label={`MRP ₹${medicine.mrp}`} tone="neutral" />
            {medicine.packLabel ? (
              <StatusChip label={medicine.packLabel} tone="neutral" />
            ) : null}
          </HStack>
        </VStack>
        <Pressable
          onPress={onAdd}
          disabled={busy}
          hitSlop={8}
          style={styles.addBtn}
          accessibilityLabel={`Add ${medicine.name} to my products`}
        >
          {busy ? (
            <ActivityIndicator size="small" color={palette.teal[700]} />
          ) : (
            <Text variant="label" style={{ color: palette.teal[700] }}>
              + Add
            </Text>
          )}
        </Pressable>
      </HStack>
    </Card>
  );
}

function ProductRow({
  product,
  onPress,
}: {
  product: ProductListItem;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} elevation="base">
      <HStack gap={14} align="center">
        <View style={styles.icon}>
          <Package size={20} color={palette.teal[600]} strokeWidth={1.9} />
        </View>
        <VStack gap={4} flex={1}>
          <HStack gap={8} align="center">
            <Text variant="label-lg" tone="primary" numberOfLines={1}>
              {product.name}
            </Text>
            {product.prescriptionRequired && (
              <Pill size={14} color={palette.danger.text} strokeWidth={2} />
            )}
          </HStack>
          <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
            {[product.sku, product.brandName, product.categoryName]
              .filter(Boolean)
              .join("  ·  ")}
          </Text>
          <HStack gap={6} wrap>
            <StatusChip
              label={`₹${product.sellingPrice} / ${product.baseUnit}`}
              tone="info"
            />
            {product.taxRatePct > 0 && (
              <StatusChip label={`GST ${product.taxRatePct}%`} tone="neutral" />
            )}
            {product.scheduleDrug ? (
              <StatusChip
                label={`Schedule ${product.scheduleDrug}`}
                tone="warning"
              />
            ) : null}
            {!product.isActive && <StatusChip label="Inactive" tone="danger" />}
          </HStack>
        </VStack>
        <ChevronRight size={18} color={palette.text.tertiary} strokeWidth={2} />
      </HStack>
    </Card>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: palette.teal[50],
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.teal[700],
    minWidth: 74,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    marginTop: 14,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.teal[50],
  },
});
