import React, { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Plus, Receipt, Undo2 } from "lucide-react-native";
import { useSales } from "@modules/sale/hooks/useSales";
import { SaleListItem } from "@modules/sale/types";
import { ScanReturnModal } from "@modules/sale/components/ScanReturnModal";
import { layout, palette } from "@shared/designSystem";
import { fmtInt, fmtMoney, fmtDate } from "@shared/format";
import { useDebouncedValue } from "@shared/hooks";
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
  ErrorState,
} from "@shared/ui";

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
  // One request per pause, like every other search in the app.
  const term = useDebouncedValue(search.trim(), 350);
  const [status, setStatus] = useState("all");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [scanReturnOpen, setScanReturnOpen] = useState(false);

  // Filter change → back to page 1 (adjusted during render, not in an effect).
  const filterKey = `${term}|${status}|${limit}`;
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
  if (term) params.search = term;
  if (status !== "all") params.status = status;
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useSales(params);
  // The debounce gap is still "searching" — otherwise the list reads as a
  // result for what's on screen when it is a result for the previous query.
  const searching = isRefetching || isLoading || search.trim() !== term;
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
          {fmtDate(s.saleDate)}
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
            {fmtMoney(s.grandTotal)}
          </Text>
          {s.totalReturned > 0 ? (
            <Text variant="caption" tone="danger">
              -{fmtMoney(s.totalReturned)}
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
      subtitle={isError ? undefined : `${fmtInt(total)} sales`}
      refreshing={searching}
      onRefresh={refetch}
      right={
        <HStack gap={8}>
          <Button
            label="Return by scan"
            size="sm"
            variant="secondary"
            fullWidth={false}
            icon={<Undo2 size={16} color={palette.text.secondary} strokeWidth={2.2} />}
            onPress={() => setScanReturnOpen(true)}
          />
          <Button
            label="New sale"
            size="sm"
            fullWidth={false}
            icon={<Plus size={18} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={() => navigation.navigate("NewSale")}
          />
        </HStack>
      }
    >
      <ScanReturnModal
        visible={scanReturnOpen}
        onClose={() => setScanReturnOpen(false)}
        onPick={(saleId, returnLineIds) => {
          setScanReturnOpen(false);
          navigation.navigate("SaleDetail", {
            id: saleId,
            openReturn: true,
            returnLineIds,
          });
        }}
      />
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

      {isError ? (
        <ErrorState
          error={error}
          title="Couldn't load your invoices"
          onRetry={() => refetch()}
          retrying={isRefetching}
          style={{ marginTop: 16 }}
        />
      ) : isLoading && sales.length === 0 ? (
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
        fmtDate(sale.saleDate),
        `${sale.itemCount} item${sale.itemCount === 1 ? "" : "s"}`,
        sale.paymentMode,
      ]
        .filter(Boolean)
        .join(" · ")}
      value={fmtMoney(sale.grandTotal)}
      valueHint={
        sale.totalReturned > 0 ? `−${fmtMoney(sale.totalReturned)}` : undefined
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
