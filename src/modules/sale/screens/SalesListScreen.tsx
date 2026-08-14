import React, { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Plus, Receipt } from "lucide-react-native";
import { useSales } from "@modules/sale/hooks/useSales";
import { SaleListItem } from "@modules/sale/types";
import { layout } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
  ListRow,
  ChipsRow,
  SearchInput,
  Pagination,
  DataTable,
  Column,
  Skeleton,
} from "@shared/ui";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const STATUS_TONE = {
  completed: "success",
  partially_returned: "warning",
  returned: "danger",
} as const;

export default function SalesListScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const gutter =
    width >= layout.wideBreakpoint
      ? layout.screenPadding
      : layout.screenPaddingPhone;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Filter change → back to page 1 (adjusted during render, not in an effect).
  const filterKey = `${search}|${status}|${limit}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const params: {
    search?: string;
    status?: string;
    page: number;
    limit: number;
  } = { page, limit };
  if (search.trim()) params.search = search.trim();
  if (status !== "all") params.status = status;
  const { data, isLoading, refetch, isRefetching } = useSales(params);
  const sales = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.pages ?? 1;

  if (!isLoading && totalPages > 0 && page > totalPages) setPage(totalPages);

  const open = (s: SaleListItem) =>
    navigation.navigate("SaleDetail", { id: s.id });

  const columns: Column<SaleListItem>[] = [
    {
      key: "invoiceNo",
      header: "Invoice",
      width: 130,
      sortable: true,
      sortValue: (s) => s.invoiceNo,
      render: (s) => (
        <Text variant="label" tone="primary">
          {s.invoiceNo}
        </Text>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      width: 200,
      sortable: true,
      sortValue: (s) => (s.customerName || "").toLowerCase(),
      render: (s) => (
        <Text variant="body-sm" tone="secondary" numberOfLines={1}>
          {s.customerName || "Walk-in"}
        </Text>
      ),
    },
    {
      key: "saleDate",
      header: "Date",
      width: 120,
      sortable: true,
      sortValue: (s) => s.saleDate,
      render: (s) => (
        <Text variant="body-sm" tone="tertiary">
          {new Date(s.saleDate).toLocaleDateString("en-IN")}
        </Text>
      ),
    },
    {
      key: "itemCount",
      header: "Items",
      width: 70,
      align: "center",
      sortable: true,
      sortValue: (s) => s.itemCount,
      render: (s) => (
        <Text variant="body-sm" tone="secondary">
          {s.itemCount}
        </Text>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 170,
      render: (s) => (
        <HStack gap={8} align="center">
          <StatusChip
            label={s.status.replace("_", " ")}
            tone={STATUS_TONE[s.status]}
          />
          {s.paymentMode ? (
            <Text variant="caption" tone="tertiary">
              {s.paymentMode}
            </Text>
          ) : null}
        </HStack>
      ),
    },
    {
      key: "grandTotal",
      header: "Total",
      width: 120,
      align: "right",
      sortable: true,
      sortValue: (s) => s.grandTotal,
      render: (s) => (
        <VStack gap={1} align="flex-end">
          <Text variant="label" tone="primary">
            {money(s.grandTotal)}
          </Text>
          {s.totalReturned > 0 ? (
            <Text variant="caption" tone="danger">
              -{money(s.totalReturned)}
            </Text>
          ) : null}
        </VStack>
      ),
    },
  ];

  return (
    <Screen
      back="Back to billing"
      overline="Sales"
      title="Invoices"
      subtitle={`${total.toLocaleString("en-IN")} sales`}
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
      right={
        <Button
          label="New sale"
          size="sm"
          fullWidth={false}
          icon={<Plus size={18} color="#FFFFFF" strokeWidth={2.2} />}
          onPress={() => navigation.navigate("NewSale")}
        />
      }
    >
      <SearchInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search invoice, customer or mobile"
      />
      <View style={{ marginHorizontal: -gutter, marginTop: 10 }}>
        <ChipsRow
          chips={[
            { key: "all", label: "All" },
            { key: "completed", label: "Completed" },
            { key: "partially_returned", label: "Part-returned" },
            { key: "returned", label: "Returned" },
          ]}
          active={status}
          onChange={setStatus}
        />
      </View>

      {isLoading && sales.length === 0 ? (
        <ListSkeleton />
      ) : (
        <View style={{ marginTop: 16 }}>
          <DataTable<SaleListItem>
            columns={columns}
            rows={sales}
            keyExtractor={(s) => s.id}
            onRowPress={open}
            mobileCard={(s) => <SaleRow sale={s} onPress={() => open(s)} />}
            emptyIcon={Receipt}
            emptyTitle="No sales yet"
            emptyMessage="Create a sale to generate a GST invoice."
          />
          {sales.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={setLimit}
                label="sales"
              />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function ListSkeleton() {
  return (
    <VStack gap={12} style={{ marginTop: 16 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Card key={i} elevation="base">
          <HStack gap={14} align="center">
            <VStack gap={6} flex={1}>
              <Skeleton width="40%" height={14} />
              <Skeleton width="70%" height={11} />
            </VStack>
            <Skeleton width={64} height={14} />
          </HStack>
        </Card>
      ))}
    </VStack>
  );
}

/**
 * The phone rendering of an invoice.
 *
 * The payment mode was a second chip beside the status, which put two lozenges
 * on every row for something that is only ever one word — it reads better in
 * the identifier line with the customer and the date. Only the status, which is
 * the field a pharmacist scans this list for, keeps its chip.
 */
function SaleRow({
  sale,
  onPress,
}: {
  sale: SaleListItem;
  onPress: () => void;
}) {
  return (
    <ListRow
      title={sale.invoiceNo}
      subtitle={[
        sale.customerName,
        new Date(sale.saleDate).toLocaleDateString(),
        `${sale.itemCount} item${sale.itemCount === 1 ? "" : "s"}`,
        sale.paymentMode,
      ]
        .filter(Boolean)
        .join(" · ")}
      value={money(sale.grandTotal)}
      valueHint={
        sale.totalReturned > 0 ? `−${money(sale.totalReturned)}` : undefined
      }
      right={
        <StatusChip
          label={sale.status.replace("_", " ")}
          tone={STATUS_TONE[sale.status]}
        />
      }
      onPress={onPress}
    />
  );
}
