import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Phone,
  Mail,
  MapPin,
  Receipt,
  Trash2,
  Wallet,
  MessageCircle,
} from "lucide-react-native";
import {
  useCustomer,
  useRemoveCustomer,
} from "@modules/customer/hooks/useCustomers";
import { customerApi } from "@modules/customer/api/customerApi";
import { useSales } from "@modules/sale/hooks/useSales";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { sendWhatsApp } from "@shared/whatsapp";
import { palette, accents, numeric } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Avatar,
  Button,
  StatusChip,
  StatRow,
  SectionHeader,
  ListRow,
  ListGroup,
  EmptyState,
  ConfirmDialog,
  PromptDialog,
  Skeleton,
} from "@shared/ui";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const STATUS_TONE = {
  completed: "success",
  partially_returned: "warning",
  returned: "danger",
} as const;

export default function CustomerDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string;
  const { data: customer } = useCustomer(id);
  const { data: sales } = useSales({ customerId: id });
  const removeMut = useRemoveCustomer();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission(PERMISSIONS.CUSTOMERS_MANAGE);
  const shopName = useAuthStore((s) => s.organization?.name) || "our pharmacy";

  const queryClient = useQueryClient();
  const { data: statement } = useQuery({
    queryKey: ["customer", "statement", id],
    queryFn: () => customerApi.statement(id, { limit: 50 }),
    enabled: Boolean(id),
  });
  const outstanding = statement?.data.outstanding ?? 0;
  const ledger = statement?.data.rows ?? [];

  const [collectOpen, setCollectOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const payMut = useMutation({
    mutationFn: (amount: number) =>
      customerApi.recordPayment(id, { amount, mode: "cash" }),
    onSuccess: () => {
      setCollectOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["customer", "statement", id],
      });
    },
  });

  const history = sales?.data ?? [];
  const totalSpent = history.reduce(
    (s, x) => s + (x.grandTotal - x.totalReturned),
    0,
  );

  if (!customer) {
    return (
      <Screen back="Back to customers" overline="Customer" title="Customer">
        <VStack gap={16}>
          <Card>
            <HStack gap={14} align="center">
              <Skeleton width={40} height={40} rounded="full" />
              <VStack gap={8} flex={1}>
                <Skeleton width="50%" height={18} />
                <Skeleton width="70%" height={14} />
              </VStack>
            </HStack>
          </Card>
          <HStack gap={12}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ flex: 1 }}>
                <Skeleton height={72} />
              </View>
            ))}
          </HStack>
          <Card>
            <VStack gap={10}>
              <Skeleton width="40%" height={16} />
              <Skeleton width="90%" height={14} />
              <Skeleton width="80%" height={14} />
            </VStack>
          </Card>
        </VStack>
      </Screen>
    );
  }

  return (
    <Screen
      back="Back to customers"
      overline="Customer"
      title={customer?.name || "Customer"}
      subtitle={customer?.mobile || ""}
    >
      <Card style={{ marginBottom: 16 }}>
        <HStack gap={14} align="center">
          {/* 40, not 54 — an initials disc is an identifier, not a portrait. */}
          <Avatar name={customer?.name || "?"} size={40} />
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
              size="sm"
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

      {/* Three figures on one panel. Only "Outstanding" carries a colour, and
          only when the customer actually owes something — a green "Net
          purchases" card was tinting a neutral fact as good news. */}
      <StatRow
        style={{ marginBottom: 16 }}
        stats={[
          { label: "Invoices", value: String(sales?.meta?.total ?? 0) },
          { label: "Net purchases", value: money(totalSpent) },
          {
            label: "Outstanding",
            value: money(outstanding),
            accent: outstanding > 0 ? accents.red : undefined,
          },
        ]}
      />

      {canManage ? (
        <HStack gap={10} style={{ marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
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
              loading={payMut.isPending}
              onPress={() => setCollectOpen(true)}
            />
          </View>
          {outstanding > 0 && customer?.mobile ? (
            <Button
              label="Remind"
              variant="secondary"
              fullWidth={false}
              icon={
                <MessageCircle
                  size={16}
                  color={palette.success.text}
                  strokeWidth={2}
                />
              }
              onPress={() =>
                sendWhatsApp(
                  customer.mobile,
                  `Dear ${customer?.name || "Customer"}, a friendly reminder from *${shopName}*: your outstanding balance is *₹${Math.round(
                    outstanding,
                  )}*. Kindly clear it at your convenience. Thank you!`,
                )
              }
            />
          ) : null}
        </HStack>
      ) : null}

      <SectionHeader title="Purchase history" />
      {history.length === 0 ? (
        <EmptyState icon={Receipt} title="No purchases yet" />
      ) : (
        /* One list surface instead of a stack of floating invoice cards. The
           status chip is only drawn when the sale is NOT plainly completed —
           chipping "completed" on every row is a green stripe down the page
           that tells the reader nothing. */
        <ListGroup>
          {history.map((s) => (
            <ListRow
              key={s.id}
              title={s.invoiceNo}
              subtitle={`${new Date(s.saleDate).toLocaleDateString()} · ${s.itemCount} item${s.itemCount === 1 ? "" : "s"}`}
              value={money(s.grandTotal)}
              right={
                s.status === "completed" ? undefined : (
                  <StatusChip
                    label={s.status.replace("_", " ")}
                    tone={STATUS_TONE[s.status]}
                  />
                )
              }
            />
          ))}
        </ListGroup>
      )}

      {ledger.length > 0 ? (
        <View>
          <SectionHeader title="Account statement" />
          {/* ListGroup already owns the surface and the hairlines between rows,
              so the hand-rolled divider Views are gone. The rows themselves stay
              hand-built rather than becoming ListRows: the signed movement has
              to sit before the running balance, and ListRow puts `right` after
              `value`. */}
          <ListGroup>
            {ledger.map((r, i) => (
              <HStack
                key={i}
                gap={10}
                align="center"
                justify="space-between"
                style={{ paddingVertical: 10, paddingHorizontal: 14 }}
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
                  style={[
                    numeric,
                    {
                      color: r.debit
                        ? palette.danger.text
                        : palette.success.text,
                    },
                  ]}
                >
                  {r.debit ? `+${money(r.debit)}` : `−${money(r.credit)}`}
                </Text>
                <Text
                  variant="body-sm"
                  weight="600"
                  tone="primary"
                  style={[numeric, { width: 74, textAlign: "right" }]}
                >
                  {money(r.balance)}
                </Text>
              </HStack>
            ))}
          </ListGroup>
        </View>
      ) : null}

      {canManage && customer?.isActive && (
        <Button
          label="Deactivate customer"
          variant="destructive"
          icon={<Trash2 size={16} color="#FFFFFF" strokeWidth={2} />}
          style={{ marginTop: 20 }}
          loading={removeMut.isPending}
          onPress={() => setRemoveOpen(true)}
        />
      )}

      <PromptDialog
        visible={collectOpen}
        title={`Collect from ${customer?.name || "customer"}`}
        message={
          outstanding > 0
            ? `Outstanding ₹${Math.round(outstanding)}. Enter the amount collected.`
            : "Enter the amount collected from this customer."
        }
        label="Amount (₹)"
        placeholder="0"
        keyboardType="decimal-pad"
        confirmLabel="Record payment"
        leading={
          <Wallet size={18} color={palette.text.tertiary} strokeWidth={1.8} />
        }
        loading={payMut.isPending}
        validate={(v) =>
          Number(v) > 0 ? null : "Enter an amount greater than 0"
        }
        onSubmit={(v) => payMut.mutate(Number(v))}
        onCancel={() => setCollectOpen(false)}
      />
      <ConfirmDialog
        visible={removeOpen}
        title="Deactivate customer?"
        message={`${customer?.name || "This customer"} will be hidden from new sales. You can reactivate later.`}
        confirmLabel="Deactivate"
        destructive
        loading={removeMut.isPending}
        onConfirm={() =>
          removeMut.mutate(id, { onSuccess: () => navigation.goBack() })
        }
        onCancel={() => setRemoveOpen(false)}
      />
    </Screen>
  );
}
