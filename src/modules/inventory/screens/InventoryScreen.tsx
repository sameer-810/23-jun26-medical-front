import React, { useState, useEffect } from "react";
import { View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Boxes,
  PackageX,
  ChevronRight,
  CalendarSearch,
} from "lucide-react-native";
import { useStock, useStockValue } from "@modules/inventory/hooks/useInventory";
import { StockSummaryItem } from "@modules/inventory/types";
import { palette, layout, numeric } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  Button,
  StatRow,
  StatusChip,
  Banner,
  ListRow,
  ChipsRow,
  Pagination,
  SearchInput,
  DataTable,
  Column,
} from "@shared/ui";
import { fmtMoney, fmtQty } from "@shared/format";

const money = fmtMoney;

export default function InventoryScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Debounce — don't run a stock search on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Filter change → back to page 1 (adjusted during render, not in an effect).
  const filterKey = `${debouncedSearch}|${filter}|${limit}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const { data: value } = useStockValue();
  const unpricedLots = value?.missingCostLots ?? 0;
  const unpricedProducts = value?.missingPriceProducts ?? 0;
  const params: {
    search?: string;
    lowStockOnly?: boolean;
    page: number;
    limit: number;
  } = { page, limit };
  if (debouncedSearch) params.search = debouncedSearch;
  if (filter === "low") params.lowStockOnly = true;
  const { data, isLoading, refetch, isRefetching } = useStock(params);
  const list = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.pages ?? 1;

  if (!isLoading && totalPages > 0 && page > totalPages) setPage(totalPages);

  const gutter =
    width >= layout.wideBreakpoint
      ? layout.screenPadding
      : layout.screenPaddingPhone;
  const open = (s: StockSummaryItem) =>
    navigation.navigate("ProductInventory", { id: s.productId });

  const columns: Column<StockSummaryItem>[] = [
    {
      key: "name",
      header: "Product",
      width: 260,
      sortable: true,
      sortValue: (s) => s.name.toLowerCase(),
      render: (s) => (
        <VStack gap={2}>
          <Text variant="label" tone="primary" numberOfLines={1}>
            {s.name}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {s.sku}
          </Text>
        </VStack>
      ),
    },
    {
      key: "available",
      header: "In stock",
      width: 150,
      sortable: true,
      sortValue: (s) => s.available,
      /**
       * Plain figures, not a chip per row.
       *
       * Every row carried a tinted pill here — 50 blue and amber lozenges down
       * a column of 50 products, which reads as decoration and leaves nothing
       * for a genuine exception to stand out against. The number is the data;
       * only a low reading takes a colour, and the "Low stock" chip at the end
       * of the row already says so.
       */
      render: (s) => (
        <Text
          variant="body-sm"
          numberOfLines={1}
          style={[
            numeric,
            { color: s.isLow ? palette.warning.text : palette.text.primary },
          ]}
        >
          {s.available}/{s.onHand} {s.baseUnit}
        </Text>
      ),
    },
    {
      key: "batches",
      header: "Batches",
      width: 90,
      align: "center",
      sortable: true,
      sortValue: (s) => s.batches,
      render: (s) => (
        <Text variant="body-sm" tone="secondary">
          {s.batches}
        </Text>
      ),
    },
    {
      key: "locations",
      header: "Locations",
      width: 100,
      align: "center",
      render: (s) => (
        <Text variant="body-sm" tone="secondary">
          {s.locations}
        </Text>
      ),
    },
    {
      key: "costValue",
      header: "Cost value",
      width: 130,
      align: "right",
      sortable: true,
      sortValue: (s) => s.costValue,
      /**
       * An unpriced lot shows a dash, not ₹0.
       *
       * Stock received without a purchase price contributes nothing to the
       * total, so the row read "₹0" for a medicine plainly sitting on the
       * shelf — which says "this was free" when it means "nobody recorded what
       * it cost". A dash is the honest rendering, and it is also the one that
       * prompts someone to go and fix the batch.
       */
      render: (s) =>
        s.unpricedLots > 0 ? (
          <Text variant="label" tone="tertiary">
            —
          </Text>
        ) : (
          <Text variant="label" tone="primary" style={numeric}>
            {money(s.costValue)}
          </Text>
        ),
    },
    {
      key: "status",
      header: "",
      width: 130,
      align: "right",
      render: (s) =>
        s.isLow ? (
          <StatusChip label="Low stock" tone="warning" />
        ) : (
          <ChevronRight
            size={18}
            color={palette.text.tertiary}
            strokeWidth={2}
          />
        ),
    },
  ];

  return (
    <Screen
      overline="Inventory"
      title="Stock on hand"
      subtitle="Live quantity, availability and valuation"
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
      // "Which batch, expiring when" is a question about the stock you're
      // already looking at — so it opens from here rather than from the nav.
      right={
        <Button
          label="Batch & expiry"
          variant="secondary"
          fullWidth={false}
          icon={
            <CalendarSearch
              size={18}
              color={palette.text.primary}
              strokeWidth={1.9}
            />
          }
          onPress={() => navigation.navigate("Search")}
        />
      }
    >
      {/* One panel, three figures. The first of these used to be a solid green
          card beside two white ones — a filled brand-colour surface makes one
          metric shout at the reader for no reason other than being first. */}
      <StatRow
        columns={3}
        stats={[
          {
            label: "Stock value (cost)",
            value: money(value?.costValue ?? 0),
            hint: unpricedLots
              ? `excludes ${unpricedLots} unpriced lot${unpricedLots === 1 ? "" : "s"}`
              : undefined,
          },
          {
            label: "Retail value",
            value: money(value?.sellValue ?? 0),
            hint: unpricedProducts
              ? `excludes ${unpricedProducts} unpriced item${unpricedProducts === 1 ? "" : "s"}`
              : undefined,
          },
          {
            label: "Units in stock",
            value: fmtQty(value?.totalUnits),
          },
        ]}
      />

      {/*
        Say why the totals are short, rather than letting someone add up the
        column and find it doesn't reach the card.

        These two figures used to be quietly incomplete in two different ways:
        they counted stock belonging to deleted products that no row showed
        (fixed in stock.repository), and they silently skip any lot received
        without a purchase price. The first was a defect; the second is missing
        data the pharmacy has to go and enter, so the number says so out loud
        and points at the filter that lists them.
      */}
      {unpricedLots || unpricedProducts ? (
        <Banner
          tone="warning"
          title="Some stock has no price recorded"
          message={
            [
              unpricedLots
                ? `${unpricedLots} lot${unpricedLots === 1 ? "" : "s"} with no purchase price`
                : null,
              unpricedProducts
                ? `${unpricedProducts} product${unpricedProducts === 1 ? "" : "s"} with no selling price`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") +
            ". Those are left out of the totals above, so the figures are lower than your real stock value."
          }
          style={{ marginTop: 10 }}
        />
      ) : null}

      <View style={{ marginTop: 12 }}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search products in stock"
        />
      </View>
      <View style={{ marginHorizontal: -gutter, marginTop: 10 }}>
        <ChipsRow
          chips={[
            { key: "all", label: "All stock" },
            { key: "low", label: "Low stock" },
          ]}
          active={filter}
          onChange={setFilter}
        />
      </View>

      <View style={{ marginTop: 16 }}>
        <DataTable<StockSummaryItem>
          columns={columns}
          rows={list}
          keyExtractor={(s) => s.productId}
          onRowPress={open}
          mobileCard={(s) => <StockRow item={s} onPress={() => open(s)} />}
          emptyIcon={filter === "low" ? PackageX : Boxes}
          emptyTitle={
            isLoading
              ? "Loading…"
              : filter === "low"
                ? "No low-stock items"
                : "No stock yet"
          }
          emptyMessage={
            filter === "low"
              ? "Everything is above its reorder level."
              : "Receive stock to see it here."
          }
        />
        {list.length > 0 ? (
          <View style={{ marginTop: 16 }}>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={setLimit}
              label="products"
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

/**
 * The phone rendering of a stock line.
 *
 * Was a card with a 46px tinted icon well and three chips under the name; the
 * quantity, the cost and the low flag were all lozenges, so nothing stood out
 * and four products filled the screen. The quantity now sits on the right where
 * a number belongs, the cost joins the identifier line, and "Low stock" is the
 * only chip left — which is the one that means something.
 */
function StockRow({
  item,
  onPress,
}: {
  item: StockSummaryItem;
  onPress: () => void;
}) {
  return (
    <ListRow
      title={item.name}
      subtitle={`${item.sku} · ${item.batches} batch${
        item.batches === 1 ? "" : "es"
      } · ${item.unpricedLots > 0 ? "cost not set" : `${money(item.costValue)} cost`}`}
      value={`${item.available}/${item.onHand}`}
      valueHint={item.baseUnit}
      right={
        item.isLow ? <StatusChip label="Low stock" tone="warning" /> : undefined
      }
      onPress={onPress}
    />
  );
}
