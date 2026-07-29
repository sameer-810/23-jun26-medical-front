import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Plus, Package, ChevronRight, Pill } from "lucide-react-native";
import { useProducts, useCategories } from "@modules/product/hooks/useProducts";
import { ProductListItem } from "@modules/product/types";
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

export default function ProductsScreen() {
  const navigation = useNavigation<any>();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission(PERMISSIONS.PRODUCTS_MANAGE);
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

  return (
    <Screen
      overline="Catalogue"
      title="Products"
      subtitle={`${total.toLocaleString("en-IN")} products`}
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
      right={
        canManage ? (
          <Button
            label="Add product"
            fullWidth={false}
            icon={<Plus size={18} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={() => navigation.navigate("ProductForm")}
          />
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
    </Screen>
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
});
