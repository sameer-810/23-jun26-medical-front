import React from "react";
import { useNavigation } from "@react-navigation/native";
import { CreditCard, Plus } from "lucide-react-native";
import { usePlans } from "@modules/admin/hooks/useAdmin";
import { AdminNav } from "@modules/admin/components/AdminNav";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
  EmptyState,
} from "@shared/ui";

export default function PlansScreen() {
  const navigation = useNavigation<any>();
  const { data: plans, isLoading } = usePlans(true);

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

      {!plans || plans.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={isLoading ? "Loading…" : "No plans yet"}
        />
      ) : (
        <VStack gap={10}>
          {plans.map((p) => (
            <Card
              key={p._id}
              elevation="base"
              onPress={() =>
                navigation.navigate("AdminPlanForm", { id: p._id })
              }
            >
              <VStack gap={8}>
                <HStack gap={10} align="center" justify="space-between">
                  <VStack gap={2} flex={1}>
                    <Text variant="label-lg" tone="primary">
                      {p.name}
                    </Text>
                    <Text variant="body-sm" tone="tertiary">
                      code: {p.code}
                    </Text>
                  </VStack>
                  <StatusChip
                    label={p.isActive ? "Active" : "Inactive"}
                    tone={p.isActive ? "success" : "neutral"}
                  />
                </HStack>
                <HStack gap={16} style={{ flexWrap: "wrap" }}>
                  <Text variant="body-sm" tone="secondary">
                    ₹{p.priceMonthly}/mo · ₹{p.priceYearly}/yr
                  </Text>
                  <Text variant="body-sm" tone="secondary">
                    Users: {p.maxUsers || "∞"} · Products:{" "}
                    {p.maxProducts || "∞"}
                  </Text>
                </HStack>
                {p.features?.length ? (
                  <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
                    {p.features.join(" · ")}
                  </Text>
                ) : null}
              </VStack>
            </Card>
          ))}
        </VStack>
      )}
    </Screen>
  );
}
