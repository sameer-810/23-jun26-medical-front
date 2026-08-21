import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Package, Pill, BookOpen } from "lucide-react-native";
import { useProducts, useCategories } from "@modules/product/hooks/useProducts";
import { ProductListItem } from "@modules/product/types";
import { medguideApi } from "@modules/medguide/api/medguideApi";
import { Medicine } from "@modules/medguide/types";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { palette, radius, layout } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Button,
  StatusChip,
  ChipsRow,
  SearchInput,
  EmptyState,
  ErrorState,
  Pagination,
  ListRow,
  ListGroup,
  SectionHeader,
} from "@shared/ui";

/** Below this the catalogue matches too much to be a useful suggestion. */
const CATALOG_MIN_CHARS = 2;

export default function ProductsScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const gutter =
    width >= layout.wideBreakpoint
      ? layout.screenPadding
      : layout.screenPaddingPhone;
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

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useProducts(params);

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
      // No count to report when the list didn't load; 0 would be a real figure.
      subtitle={
        isError ? undefined : `${total.toLocaleString("en-IN")} products`
      }
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
      right={
        canManage || canOpenMedGuide ? (
          <HStack gap={8} align="center">
            {canOpenMedGuide && (
              <Button
                label="MedGuide"
                variant="secondary"
                size="sm"
                fullWidth={false}
                icon={
                  <BookOpen
                    size={14}
                    color={palette.text.secondary}
                    strokeWidth={2}
                  />
                }
                onPress={() => navigation.navigate("MedGuide")}
              />
            )}
            {canManage && (
              <Button
                label="Add product"
                size="sm"
                fullWidth={false}
                icon={<Plus size={14} color="#FFFFFF" strokeWidth={2.2} />}
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
        // Bleed the scroller to the screen edges so chips can run off-canvas
        // rather than stopping inside the gutter. The gutter is responsive now,
        // so this has to read the same token Screen does.
        <View style={{ marginHorizontal: -gutter, marginTop: 10 }}>
          <ChipsRow
            chips={categoryChips}
            active={categoryId}
            onChange={setCategoryId}
          />
        </View>
      )}

      {/* Three states: failure, no match for the current filters, and an empty
          catalogue — only the last gets the onboarding copy. */}
      {isError ? (
        <ErrorState
          error={error}
          title="Couldn't load your products"
          onRetry={() => refetch()}
          retrying={isRefetching}
          style={{ marginTop: 12 }}
        />
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={
            isLoading
              ? "Loading…"
              : debouncedSearch || categoryId !== "all"
                ? "No products match that"
                : "No products yet"
          }
          message={
            debouncedSearch || categoryId !== "all"
              ? "Try a different search term or clear the filters."
              : "Add your first product to start building the catalogue."
          }
          action={
            canManage && !debouncedSearch && categoryId === "all" ? (
              <Button
                label="Add product"
                fullWidth={false}
                onPress={() => navigation.navigate("ProductForm")}
              />
            ) : undefined
          }
        />
      ) : (
        <VStack gap={12} style={{ marginTop: 12 }}>
          <ListGroup>
            {products.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                onPress={() => navigation.navigate("ProductForm", { id: p.id })}
              />
            ))}
          </ListGroup>

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
        <View>
          <SectionHeader
            title="From the medicine catalogue"
            action={
              catalogLoading ? (
                <ActivityIndicator size="small" color={palette.teal[600]} />
              ) : undefined
            }
          />
          {catalogSuggestions.length === 0 ? (
            <Text variant="body-sm" tone="tertiary">
              {catalogLoading
                ? "Looking…"
                : "Nothing else in the catalogue matches that."}
            </Text>
          ) : (
            <ListGroup>
              {catalogSuggestions.map((m) => (
                <CatalogRow
                  key={m._id}
                  medicine={m}
                  busy={adding === m._id}
                  onAdd={() => addFromCatalog(m)}
                />
              ))}
            </ListGroup>
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
    <ListRow
      title={medicine.name}
      subtitle={
        [
          medicine.saltComposition,
          medicine.manufacturerName,
          medicine.packLabel,
        ]
          .filter(Boolean)
          .join(" · ") || "—"
      }
      value={`₹${medicine.mrp}`}
      valueHint="MRP"
      chevron={false}
      right={
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
            <Text variant="label-sm" style={{ color: palette.teal[700] }}>
              + Add
            </Text>
          )}
        </Pressable>
      }
    />
  );
}

/**
 * One medicine in the catalogue.
 *
 * This was a bordered card 118px tall — a 46px tinted icon well, the name, an
 * identifier line and a row of pill chips, with a 12px gap to the next card. A
 * chemist scrolling 121 products saw four at a time on a phone and six on a
 * 900px desktop window. It is now a 44/60px row on a shared surface: the price
 * moves to the right where a number belongs, the GST rate joins the identifier
 * line, and only genuinely exceptional states (Schedule drug, Rx, inactive)
 * still earn a chip.
 */
function ProductRow({
  product,
  onPress,
}: {
  product: ProductListItem;
  onPress: () => void;
}) {
  const flags = (
    <HStack gap={4} align="center">
      {product.prescriptionRequired ? (
        <Pill size={13} color={palette.danger.text} strokeWidth={2} />
      ) : null}
      {product.scheduleDrug ? (
        <StatusChip label={`Sch ${product.scheduleDrug}`} tone="warning" />
      ) : null}
      {!product.isActive ? <StatusChip label="Inactive" tone="danger" /> : null}
    </HStack>
  );

  const hasFlags =
    product.prescriptionRequired || product.scheduleDrug || !product.isActive;

  return (
    <ListRow
      title={product.name}
      subtitle={[
        product.sku,
        product.brandName,
        product.taxRatePct > 0 ? `GST ${product.taxRatePct}%` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      value={`₹${product.sellingPrice}`}
      valueHint={`per ${product.baseUnit}`}
      right={hasFlags ? flags : undefined}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  addBtn: {
    paddingHorizontal: 10,
    height: 28,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border.strong,
    minWidth: 62,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    marginTop: 12,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: palette.teal[50],
  },
});
