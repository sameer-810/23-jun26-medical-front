import React, { useState, useEffect } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Boxes,
  IndianRupee,
  PackageX,
  ChevronRight,
  CalendarSearch,
} from "lucide-react-native";
import { useStock, useStockValue } from "@modules/inventory/hooks/useInventory";
import { StockSummaryItem } from "@modules/inventory/types";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatTile,
  StatusChip,
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
  const cols = width >= 640 ? 3 : 1;
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

  const tileW = cols === 1 ? "100%" : "33.33%";
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
      render: (s) => (
        <StatusChip
          label={`${s.available}/${s.onHand} ${s.baseUnit}`}
          tone={s.isLow ? "warning" : "info"}
        />
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
      render: (s) => (
        <Text variant="label" tone="primary">
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
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}
      >
        <View style={{ width: tileW, padding: 6 }}>
          <StatTile
            label="Stock value (cost)"
            value={money(value?.costValue ?? 0)}
            icon={IndianRupee}
            tone="teal"
          />
        </View>
        <View style={{ width: tileW, padding: 6 }}>
          <StatTile
            label="Retail value"
            value={money(value?.sellValue ?? 0)}
            icon={IndianRupee}
            tone="light"
          />
        </View>
        <View style={{ width: tileW, padding: 6 }}>
          <StatTile
            label="Units in stock"
            value={fmtQty(value?.totalUnits)}
            icon={Boxes}
            tone="light"
          />
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search products in stock"
        />
      </View>
      <View style={{ marginHorizontal: -24, marginTop: 12 }}>
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

function StockRow({
  item,
  onPress,
}: {
  item: StockSummaryItem;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} elevation="base">
      <HStack gap={14} align="center">
        <View
          style={[
            styles.icon,
            item.isLow && { backgroundColor: palette.warning.bg },
          ]}
        >
          <Boxes
            size={20}
            color={item.isLow ? palette.warning.text : palette.teal[600]}
            strokeWidth={1.9}
          />
        </View>
        <VStack gap={4} flex={1}>
          <Text variant="label-lg" tone="primary" numberOfLines={1}>
            {item.name}
          </Text>
          <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
            {item.sku} · {item.batches} batch{item.batches === 1 ? "" : "es"} ·{" "}
            {item.locations} location{item.locations === 1 ? "" : "s"}
          </Text>
          <HStack gap={6} wrap>
            <StatusChip
              label={`${item.available}/${item.onHand} ${item.baseUnit}`}
              tone="info"
            />
            <StatusChip
              label={`${money(item.costValue)} cost`}
              tone="neutral"
            />
            {item.isLow && <StatusChip label="Low stock" tone="warning" />}
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
