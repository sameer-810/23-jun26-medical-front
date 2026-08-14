import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
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

  if (!supplier) {
    return (
      <Screen back="Back to suppliers" overline="Supplier" title="Supplier">
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
      back="Back to suppliers"
      overline="Supplier"
      title={supplier?.name || "Supplier"}
      subtitle={supplier?.contactPerson || ""}
    >
      <Card style={{ marginBottom: 16 }}>
        <HStack gap={14} align="center">
          {/* 40, not 54 — an initials disc is an identifier, not a portrait. */}
          <Avatar name={supplier?.name || "?"} size={40} tone="slate" />
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
              size="sm"
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

      {/* Three figures on one panel. "Total purchased" lost its filled green
          card — it is a lifetime total, not a status — leaving colour to the
          one metric that is a live obligation, and only when it is non-zero. */}
      <StatRow
        style={{ marginBottom: 16 }}
        stats={[
          {
            label: "Purchases",
            value: String(supplier?.purchases?.count ?? 0),
          },
          {
            label: "Total purchased",
            value: money(supplier?.purchases?.value ?? 0),
          },
          {
            label: "Need to pay",
            value: money(outstanding),
            accent: outstanding > 0 ? accents.red : undefined,
          },
        ]}
      />

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
          style={{ marginBottom: 20 }}
          loading={payMut.isPending}
          onPress={() => setPayOpen(true)}
        />
      ) : null}

      <SectionHeader title="Purchase history" />
      {(purchases || []).length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="No purchases yet"
          message="Goods received from this supplier appear here."
        />
      ) : (
        /* One list surface instead of a stack of floating receipt cards. */
        <ListGroup>
          {(purchases || []).map((p) => (
            <ListRow
              key={p.id}
              title={p.receiptNo}
              subtitle={`${new Date(p.receivedAt).toLocaleDateString()} · ${p.lineCount} line${p.lineCount === 1 ? "" : "s"} · ${p.totalQuantity} units`}
              value={money(p.totalValue)}
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

      {canManage && supplier?.isActive && (
        <Button
          label="Deactivate supplier"
          variant="destructive"
          icon={<Trash2 size={16} color="#FFFFFF" strokeWidth={2} />}
          style={{ marginTop: 20 }}
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
