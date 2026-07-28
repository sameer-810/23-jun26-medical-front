import React from "react";
import { View, Pressable, Platform, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Phone,
  Mail,
  MapPin,
  Receipt,
  Trash2,
  Wallet,
} from "lucide-react-native";
import {
  useCustomer,
  useRemoveCustomer,
} from "@modules/customer/hooks/useCustomers";
import { customerApi } from "@modules/customer/api/customerApi";
import { useSales } from "@modules/sale/hooks/useSales";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { palette } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Avatar,
  Button,
  StatusChip,
  StatTile,
  EmptyState,
} from "@shared/ui";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const STATUS_TONE = {
  completed: "success",
  partially_returned: "warning",
  returned: "danger",
} as const;

function confirm(msg: string, onYes: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(msg)) onYes();
  } else {
    Alert.alert("Please confirm", msg, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: onYes },
    ]);
  }
}

export default function CustomerDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string;
  const { data: customer } = useCustomer(id);
  const { data: sales } = useSales({ customerId: id });
  const removeMut = useRemoveCustomer();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission(PERMISSIONS.CUSTOMERS_MANAGE);

  const queryClient = useQueryClient();
  const { data: statement } = useQuery({
    queryKey: ["customer", "statement", id],
    queryFn: () => customerApi.statement(id, { limit: 50 }),
    enabled: Boolean(id),
  });
  const outstanding = statement?.data.outstanding ?? 0;
  const ledger = statement?.data.rows ?? [];

  const payMut = useMutation({
    mutationFn: (amount: number) =>
      customerApi.recordPayment(id, { amount, mode: "cash" }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["customer", "statement", id],
      }),
  });

  const collect = () => {
    if (Platform.OS !== "web") return;
    const raw = window.prompt(
      `Collect payment from ${customer?.name || "customer"} (outstanding ₹${Math.round(outstanding)}):`,
    );
    const amt = Number(raw);
    if (raw && amt > 0) payMut.mutate(amt);
  };

  const history = sales?.data ?? [];
  const totalSpent = history.reduce(
    (s, x) => s + (x.grandTotal - x.totalReturned),
    0,
  );

  return (
    <Screen
      overline="Customer"
      title={customer?.name || "Customer"}
      subtitle={customer?.mobile || ""}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={6}
        style={{ marginBottom: 16 }}
      >
        <HStack gap={6} align="center">
          <ArrowLeft size={18} color={palette.text.link} strokeWidth={2} />
          <Text variant="label" tone="link">
            Back to customers
          </Text>
        </HStack>
      </Pressable>

      <Card style={{ marginBottom: 16 }}>
        <HStack gap={14} align="center">
          <Avatar name={customer?.name || "?"} size={54} />
          <VStack gap={6} flex={1}>
            {customer?.mobile ? (
              <HStack gap={6} align="center">
                <Phone
                  size={14}
                  color={palette.text.tertiary}
                  strokeWidth={1.9}
                />
                <Text variant="body-sm" tone="secondary">
                  {customer.mobile}
                </Text>
              </HStack>
            ) : null}
            {customer?.email ? (
              <HStack gap={6} align="center">
                <Mail
                  size={14}
                  color={palette.text.tertiary}
                  strokeWidth={1.9}
                />
                <Text variant="body-sm" tone="secondary">
                  {customer.email}
                </Text>
              </HStack>
            ) : null}
            {customer?.address ? (
              <HStack gap={6} align="center">
                <MapPin
                  size={14}
                  color={palette.text.tertiary}
                  strokeWidth={1.9}
                />
                <Text variant="body-sm" tone="secondary">
                  {customer.address}
                </Text>
              </HStack>
            ) : null}
            {customer?.gstin ? (
              <StatusChip label={`GSTIN ${customer.gstin}`} tone="neutral" />
            ) : null}
          </VStack>
          {canManage && (
            <Button
              label="Edit"
              variant="secondary"
              fullWidth={false}
              icon={
                <Pencil
                  size={15}
                  color={palette.text.primary}
                  strokeWidth={2}
                />
              }
              onPress={() => navigation.navigate("CustomerForm", { id })}
            />
          )}
        </HStack>
      </Card>

      <HStack gap={12} style={{ marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Invoices"
            value={String(sales?.meta?.total ?? 0)}
            tone="light"
          />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Net purchases"
            value={money(totalSpent)}
            tone="teal"
          />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Outstanding"
            value={money(outstanding)}
            accent={
              outstanding > 0
                ? { color: palette.danger.text, tint: palette.danger.bg }
                : undefined
            }
          />
        </View>
      </HStack>

      {canManage ? (
        <Button
          label={
            outstanding > 0
              ? `Collect payment (₹${Math.round(outstanding)} due)`
              : "Collect payment"
          }
          variant={outstanding > 0 ? "primary" : "secondary"}
          icon={
            <Wallet
              size={16}
              color={outstanding > 0 ? "#FFFFFF" : palette.text.secondary}
              strokeWidth={2}
            />
          }
          style={{ marginBottom: 24 }}
          loading={payMut.isPending}
          onPress={collect}
        />
      ) : null}

      <Text variant="h3" tone="primary" style={{ marginBottom: 12 }}>
        Purchase history
      </Text>
      {history.length === 0 ? (
        <EmptyState icon={Receipt} title="No purchases yet" />
      ) : (
        <VStack gap={12}>
          {history.map((s) => (
            <Card key={s.id} elevation="base">
              <HStack align="center" justify="space-between">
                <VStack gap={3} flex={1}>
                  <Text variant="label-lg" tone="primary">
                    {s.invoiceNo}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    {new Date(s.saleDate).toLocaleDateString()} · {s.itemCount}{" "}
                    item{s.itemCount === 1 ? "" : "s"}
                  </Text>
                </VStack>
                <VStack gap={4} align="flex-end">
                  <Text variant="label-lg" tone="primary">
                    {money(s.grandTotal)}
                  </Text>
                  <StatusChip
                    label={s.status.replace("_", " ")}
                    tone={STATUS_TONE[s.status]}
                  />
                </VStack>
              </HStack>
            </Card>
          ))}
        </VStack>
      )}

      {ledger.length > 0 ? (
        <VStack gap={12} style={{ marginTop: 24 }}>
          <Text variant="h3" tone="primary">
            Account statement
          </Text>
          <Card padded={false} style={{ paddingVertical: 4 }}>
            {ledger.map((r, i) => (
              <View key={i}>
                {i > 0 ? (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: palette.border.subtle,
                    }}
                  />
                ) : null}
                <HStack
                  gap={10}
                  align="center"
                  justify="space-between"
                  style={{ paddingVertical: 10, paddingHorizontal: 12 }}
                >
                  <VStack gap={1} flex={1}>
                    <Text variant="body-sm" tone="primary">
                      {r.type} {r.ref ? `· ${r.ref}` : ""}
                    </Text>
                    <Text variant="caption" tone="tertiary">
                      {new Date(r.date).toLocaleDateString("en-IN")}
                      {r.note ? ` · ${r.note}` : ""}
                    </Text>
                  </VStack>
                  <Text
                    variant="body-sm"
                    weight="600"
                    style={{
                      color: r.debit
                        ? palette.danger.text
                        : palette.success.text,
                    }}
                  >
                    {r.debit ? `+${money(r.debit)}` : `−${money(r.credit)}`}
                  </Text>
                  <Text
                    variant="body-sm"
                    weight="700"
                    tone="primary"
                    style={{ width: 74, textAlign: "right" }}
                  >
                    {money(r.balance)}
                  </Text>
                </HStack>
              </View>
            ))}
          </Card>
        </VStack>
      ) : null}

      {canManage && customer?.isActive && (
        <Button
          label="Deactivate customer"
          variant="destructive"
          icon={<Trash2 size={16} color="#FFFFFF" strokeWidth={2} />}
          style={{ marginTop: 24 }}
          loading={removeMut.isPending}
          onPress={() =>
            confirm("Deactivate this customer?", () =>
              removeMut.mutate(id, { onSuccess: () => navigation.goBack() }),
            )
          }
        />
      )}
    </Screen>
  );
}
