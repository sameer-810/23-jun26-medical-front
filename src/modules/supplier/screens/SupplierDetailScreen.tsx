import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Phone,
  Mail,
  MapPin,
  PackageCheck,
  Trash2,
  Wallet,
} from "lucide-react-native";
import {
  useSupplier,
  useSupplierPurchases,
  useRemoveSupplier,
} from "@modules/supplier/hooks/useSuppliers";
import { supplierApi } from "@modules/supplier/api/supplierApi";
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
  ConfirmDialog,
  PromptDialog,
} from "@shared/ui";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function SupplierDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string;
  const { data: supplier } = useSupplier(id);
  const { data: purchases } = useSupplierPurchases(id);
  const removeMut = useRemoveSupplier();
  const canManage = useAuthStore((s) => s.hasPermission)(
    PERMISSIONS.SUPPLIERS_MANAGE,
  );

  const queryClient = useQueryClient();
  const { data: statement } = useQuery({
    queryKey: ["supplier", "statement", id],
    queryFn: () => supplierApi.statement(id, { limit: 50 }),
    enabled: Boolean(id),
  });
  const outstanding = statement?.data.outstanding ?? 0;
  const ledger = statement?.data.rows ?? [];

  const [payOpen, setPayOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const payMut = useMutation({
    mutationFn: (amount: number) =>
      supplierApi.recordPayment(id, { amount, mode: "cash" }),
    onSuccess: () => {
      setPayOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["supplier", "statement", id],
      });
    },
  });

  return (
    <Screen
      overline="Supplier"
      title={supplier?.name || "Supplier"}
      subtitle={supplier?.contactPerson || ""}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={6}
        style={{ marginBottom: 16 }}
      >
        <HStack gap={6} align="center">
          <ArrowLeft size={18} color={palette.text.link} strokeWidth={2} />
          <Text variant="label" tone="link">
            Back to suppliers
          </Text>
        </HStack>
      </Pressable>

      <Card style={{ marginBottom: 16 }}>
        <HStack gap={14} align="center">
          <Avatar name={supplier?.name || "?"} size={54} tone="slate" />
          <VStack gap={6} flex={1}>
            {supplier?.mobile ? (
              <HStack gap={6} align="center">
                <Phone
                  size={14}
                  color={palette.text.tertiary}
                  strokeWidth={1.9}
                />
                <Text variant="body-sm" tone="secondary">
                  {supplier.mobile}
                </Text>
              </HStack>
            ) : null}
            {supplier?.email ? (
              <HStack gap={6} align="center">
                <Mail
                  size={14}
                  color={palette.text.tertiary}
                  strokeWidth={1.9}
                />
                <Text variant="body-sm" tone="secondary">
                  {supplier.email}
                </Text>
              </HStack>
            ) : null}
            {supplier?.address ? (
              <HStack gap={6} align="center">
                <MapPin
                  size={14}
                  color={palette.text.tertiary}
                  strokeWidth={1.9}
                />
                <Text variant="body-sm" tone="secondary">
                  {supplier.address}
                </Text>
              </HStack>
            ) : null}
            {supplier?.gstin ? (
              <StatusChip label={`GSTIN ${supplier.gstin}`} tone="neutral" />
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
              onPress={() => navigation.navigate("SupplierForm", { id })}
            />
          )}
        </HStack>
      </Card>

      <HStack gap={12} style={{ marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Purchases"
            value={String(supplier?.purchases?.count ?? 0)}
            tone="light"
          />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Total purchased"
            value={money(supplier?.purchases?.value ?? 0)}
            tone="teal"
          />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Need to pay"
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
              ? `Pay supplier (₹${Math.round(outstanding)} due)`
              : "Pay supplier"
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
          onPress={() => setPayOpen(true)}
        />
      ) : null}

      <Text variant="h3" tone="primary" style={{ marginBottom: 12 }}>
        Purchase history
      </Text>
      {(purchases || []).length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="No purchases yet"
          message="Goods received from this supplier appear here."
        />
      ) : (
        <VStack gap={12}>
          {(purchases || []).map((p) => (
            <Card key={p.id} elevation="base">
              <HStack align="center" justify="space-between">
                <VStack gap={3} flex={1}>
                  <Text variant="label-lg" tone="primary">
                    {p.receiptNo}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    {new Date(p.receivedAt).toLocaleDateString()} ·{" "}
                    {p.lineCount} line{p.lineCount === 1 ? "" : "s"} ·{" "}
                    {p.totalQuantity} units
                  </Text>
                </VStack>
                <Text variant="label-lg" tone="primary">
                  {money(p.totalValue)}
                </Text>
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

      {canManage && supplier?.isActive && (
        <Button
          label="Deactivate supplier"
          variant="destructive"
          icon={<Trash2 size={16} color="#FFFFFF" strokeWidth={2} />}
          style={{ marginTop: 24 }}
          loading={removeMut.isPending}
          onPress={() => setRemoveOpen(true)}
        />
      )}

      <PromptDialog
        visible={payOpen}
        title={`Pay ${supplier?.name || "supplier"}`}
        message={
          outstanding > 0
            ? `Outstanding ₹${Math.round(outstanding)}. Enter the amount paid.`
            : "Enter the amount paid to this supplier."
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
        onCancel={() => setPayOpen(false)}
      />
      <ConfirmDialog
        visible={removeOpen}
        title="Deactivate supplier?"
        message={`${supplier?.name || "This supplier"} will be hidden from new purchases. You can reactivate later.`}
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
