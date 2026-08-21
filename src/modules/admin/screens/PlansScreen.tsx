import React from "react";
import { useNavigation } from "@react-navigation/native";
import { CreditCard, Plus } from "lucide-react-native";
import { usePlans } from "@modules/admin/hooks/useAdmin";
import { AdminNav } from "@modules/admin/components/AdminNav";
import type { Plan } from "@modules/admin/types";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
  DataTable,
  Column,
  Skeleton,
  ErrorState,
} from "@shared/ui";

export default function PlansScreen() {
  const navigation = useNavigation<any>();
  const {
    data: plans,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = usePlans(true);
  const items = plans ?? [];

  const open = (p: Plan) => navigation.navigate("AdminPlanForm", { id: p._id });

  const columns: Column<Plan>[] = [
    {
      key: "name",
      header: "Plan",
      width: 200,
      sortable: true,
      sortValue: (p) => (p.name || "").toLowerCase(),
      render: (p) => (
        <VStack gap={2}>
          <Text variant="label" tone="primary">
            {p.name}
          </Text>
          <Text variant="caption" tone="tertiary">
            code: {p.code}
          </Text>
        </VStack>
      ),
    },
    {
      key: "priceMonthly",
      header: "Price",
      width: 180,
      sortable: true,
      sortValue: (p) => p.priceMonthly,
      render: (p) => (
        <Text variant="body-sm" tone="secondary">
          ₹{p.priceMonthly}/mo · ₹{p.priceYearly}/yr
        </Text>
      ),
    },
    {
      key: "limits",
      header: "Limits",
      width: 200,
      render: (p) => (
        <Text variant="body-sm" tone="secondary">
          Users: {p.maxUsers || "∞"} · Products: {p.maxProducts || "∞"}
        </Text>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      width: 120,
      render: (p) => (
        <StatusChip
          label={p.isActive ? "Active" : "Inactive"}
          tone={p.isActive ? "success" : "neutral"}
        />
      ),
    },
  ];

  return (
    <Screen
      overline="Platform"
      title="Subscription plans"
      right={
        <Button
          label="Add plan"
          size="sm"
          icon={<Plus size={16} color="#FFFFFF" strokeWidth={2.2} />}
          onPress={() => navigation.navigate("AdminPlanForm", {})}
        />
      }
    >
      <AdminNav active="plans" />

      {/* "No plans yet" would invite an operator to recreate plans that every
          paying workspace is already subscribed to. */}
      {isError ? (
        <ErrorState
          error={error}
          title="Couldn't load the plans"
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      ) : isLoading && items.length === 0 ? (
        <ListSkeleton />
      ) : (
        <DataTable<Plan>
          columns={columns}
          rows={items}
          keyExtractor={(p) => p._id}
          onRowPress={open}
          pageSize={25}
          mobileCard={(p) => <PlanRow plan={p} onPress={() => open(p)} />}
          emptyIcon={CreditCard}
          emptyTitle="No plans yet"
        />
      )}
    </Screen>
  );
}

function ListSkeleton() {
  return (
    <VStack gap={10}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Card key={i} elevation="base">
          <VStack gap={8}>
            <HStack gap={10} align="center" justify="space-between">
              <Skeleton width="35%" height={16} />
              <Skeleton width={70} height={16} />
            </HStack>
            <Skeleton width="60%" height={12} />
          </VStack>
        </Card>
      ))}
    </VStack>
  );
}

function PlanRow({ plan, onPress }: { plan: Plan; onPress: () => void }) {
  return (
    <Card elevation="base" onPress={onPress}>
      <VStack gap={8}>
        <HStack gap={10} align="center" justify="space-between">
          <VStack gap={2} flex={1}>
            <Text variant="label-lg" tone="primary">
              {plan.name}
            </Text>
            <Text variant="body-sm" tone="tertiary">
              code: {plan.code}
            </Text>
          </VStack>
          <StatusChip
            label={plan.isActive ? "Active" : "Inactive"}
            tone={plan.isActive ? "success" : "neutral"}
          />
        </HStack>
        <HStack gap={16} style={{ flexWrap: "wrap" }}>
          <Text variant="body-sm" tone="secondary">
            ₹{plan.priceMonthly}/mo · ₹{plan.priceYearly}/yr
          </Text>
          <Text variant="body-sm" tone="secondary">
            Users: {plan.maxUsers || "∞"} · Products: {plan.maxProducts || "∞"}
          </Text>
        </HStack>
        {plan.features?.length ? (
          <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
            {plan.features.join(" · ")}
          </Text>
        ) : null}
      </VStack>
    </Card>
  );
}
