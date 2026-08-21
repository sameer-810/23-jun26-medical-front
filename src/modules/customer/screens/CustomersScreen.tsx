import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Plus, Users } from "lucide-react-native";
import { useCustomers } from "@modules/customer/hooks/useCustomers";
import { Customer } from "@modules/customer/types";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  ListRow,
  SearchInput,
  Pagination,
  DataTable,
  Column,
  Skeleton,
  ErrorState,
} from "@shared/ui";

export default function CustomersScreen() {
  const navigation = useNavigation<any>();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canWrite =
    hasPermission(PERMISSIONS.CUSTOMERS_MANAGE) ||
    hasPermission(PERMISSIONS.SALES_MANAGE);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Filter change → back to page 1 (adjusted during render, not in an effect).
  const filterKey = `${search}|${limit}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useCustomers({
      ...(search.trim() ? { search: search.trim() } : {}),
      page,
      limit,
    });
  const customers = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.pages ?? 1;

  if (!isLoading && totalPages > 0 && page > totalPages) setPage(totalPages);

  const open = (c: Customer) =>
    navigation.navigate("CustomerDetail", { id: c.id });

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "Name",
      width: 240,
      sortable: true,
      sortValue: (c) => c.name.toLowerCase(),
      render: (c) => (
        <Text variant="label" tone="primary" numberOfLines={1}>
          {c.name}
        </Text>
      ),
    },
    {
      key: "mobile",
      header: "Mobile",
      width: 150,
      sortable: true,
      sortValue: (c) => c.mobile || "",
      render: (c) => (
        <Text variant="body-sm" tone="secondary">
          {c.mobile || "—"}
        </Text>
      ),
    },
    {
      key: "gstin",
      header: "GSTIN",
      width: 220,
      render: (c) => (
        <Text
          variant="body-sm"
          tone={c.gstin ? "secondary" : "tertiary"}
          numberOfLines={1}
        >
          {c.gstin || "—"}
        </Text>
      ),
    },
  ];

  return (
    <Screen
      overline="Partners"
      title="Customers"
      subtitle={
        isError ? undefined : `${total.toLocaleString("en-IN")} customers`
      }
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
      right={
        canWrite ? (
          <Button
            label="Add customer"
            fullWidth={false}
            icon={<Plus size={18} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={() => navigation.navigate("CustomerForm")}
          />
        ) : undefined
      }
    >
      <SearchInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or mobile"
      />

      {isError ? (
        <ErrorState
          error={error}
          title="Couldn't load your customers"
          onRetry={() => refetch()}
          retrying={isRefetching}
          style={{ marginTop: 16 }}
        />
      ) : isLoading && customers.length === 0 ? (
        <ListSkeleton />
      ) : (
        <View style={{ marginTop: 16 }}>
          <DataTable<Customer>
            columns={columns}
            rows={customers}
            keyExtractor={(c) => c.id}
            onRowPress={open}
            mobileCard={(c) => (
              <CustomerRow customer={c} onPress={() => open(c)} />
            )}
            emptyIcon={Users}
            emptyTitle="No customers yet"
            emptyMessage="Add customers to track purchase history and speed up billing."
          />
          {customers.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={setLimit}
                label="customers"
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
              <Skeleton width="45%" height={14} />
              <Skeleton width="30%" height={11} />
            </VStack>
          </HStack>
        </Card>
      ))}
    </VStack>
  );
}

function CustomerRow({
  customer,
  onPress,
}: {
  customer: Customer;
  onPress: () => void;
}) {
  // The GSTIN was a chip of its own; it is an identifier, not a status, so it
  // belongs on the identifier line beside the mobile number.
  return (
    <ListRow
      title={customer.name}
      subtitle={[customer.mobile || "No mobile", customer.gstin]
        .filter(Boolean)
        .join(" · ")}
      onPress={onPress}
    />
  );
}
