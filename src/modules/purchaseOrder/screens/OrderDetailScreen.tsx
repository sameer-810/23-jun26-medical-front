import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, CheckCircle2, Ban, MessageCircle } from "lucide-react-native";
import { purchaseOrderApi } from "@modules/purchaseOrder/api/purchaseOrderApi";
import { useSupplier } from "@modules/supplier/hooks/useSuppliers";
import { useAuthStore } from "@shared/store/useAuthStore";
import { sendWhatsApp } from "@shared/whatsapp";
import { apiErrorMessage } from "@api/apiClient";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
  Skeleton,
  ConfirmDialog,
} from "@shared/ui";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function OrderDetailScreen() {
  // Cancelling a placed order is not a style choice — it ends a commitment to a
  // distributor. It gets a confirm like every other destructive action.
  const [cancelOpen, setCancelOpen] = useState(false);
  const [receivedOpen, setReceivedOpen] = useState(false);
  const route = useRoute<any>();
  const id = route.params?.id as string;
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => purchaseOrderApi.get(id),
    enabled: Boolean(id),
  });

  const statusMut = useMutation({
    mutationFn: (status: "placed" | "received" | "cancelled") =>
      purchaseOrderApi.setStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const status = order?.status;
  const shopName = useAuthStore((s) => s.organization?.name) || "our pharmacy";
  const { data: supplier } = useSupplier(order?.supplierId || "");

  const waPO = () => {
    if (!order) return "";
    const items = order.lines
      .map((l) => `• ${l.productName} × ${l.quantity}`)
      .join("\n");
    return `*${shopName}*\nPurchase Order ${order.orderNo}\n\n${items}\n\nEstimated value: ${money(
      order.estimatedValue,
    )}\nPlease confirm availability & dispatch. Thank you.`;
  };

  return (
    <Screen
      back="Back to orders"
      overline="Purchase order"
      title={order?.orderNo || "Order"}
      subtitle={order?.supplierName || ""}
    >
      {!order ? (
        isLoading ? (
          <VStack gap={16}>
            <Card>
              <VStack gap={10}>
                <HStack justify="space-between" align="center">
                  <Skeleton width={90} height={22} rounded="full" />
                  <Skeleton width={80} height={14} />
                </HStack>
                <HStack justify="space-between">
                  <Skeleton width="30%" height={14} />
                  <Skeleton width="40%" height={14} />
                </HStack>
                <HStack justify="space-between">
                  <Skeleton width="35%" height={14} />
                  <Skeleton width="35%" height={14} />
                </HStack>
              </VStack>
            </Card>
            {[0, 1].map((i) => (
              <Card key={i}>
                <HStack justify="space-between" align="center">
                  <VStack gap={6} flex={1}>
                    <Skeleton width="60%" height={16} />
                    <Skeleton width="35%" height={12} />
                  </VStack>
                  <Skeleton width={40} height={16} />
                </HStack>
              </Card>
            ))}
          </VStack>
        ) : (
          <Text variant="body-sm" tone="tertiary">
            Order not found.
          </Text>
        )
      ) : (
        <VStack gap={16}>
          <Card>
            <VStack gap={10}>
              <HStack justify="space-between" align="center">
                <StatusChip
                  label={order.status}
                  tone={
                    order.status === "received"
                      ? "success"
                      : order.status === "cancelled"
                        ? "danger"
                        : order.status === "placed"
                          ? "info"
                          : "neutral"
                  }
                />
                <Text variant="body-sm" tone="tertiary">
                  {new Date(order.createdAt).toLocaleDateString("en-IN")}
                </Text>
              </HStack>
              <HStack justify="space-between">
                <Text variant="body-sm" tone="tertiary">
                  Items
                </Text>
                <Text variant="label">
                  {order.lines.length} · {order.totalQuantity} units
                </Text>
              </HStack>
              <HStack justify="space-between">
                <Text variant="body-sm" tone="tertiary">
                  Estimated value
                </Text>
                <Text variant="label">{money(order.estimatedValue)}</Text>
              </HStack>
              {order.note ? (
                <Text variant="body-sm" tone="secondary">
                  {order.note}
                </Text>
              ) : null}
            </VStack>
          </Card>

          {statusMut.isError ? (
            <View style={styles.errorBox}>
              <Text variant="body-sm" tone="danger">
                {apiErrorMessage(statusMut.error)}
              </Text>
            </View>
          ) : null}

          {/* Send the PO to the supplier over WhatsApp */}
          {supplier?.mobile && status !== "cancelled" ? (
            <Button
              label="Send to supplier on WhatsApp"
              variant="secondary"
              icon={
                <MessageCircle
                  size={16}
                  color={palette.success.text}
                  strokeWidth={2}
                />
              }
              onPress={() => sendWhatsApp(supplier.mobile, waPO())}
            />
          ) : null}

          {/* Status actions */}
          {status === "draft" || status === "placed" ? (
            <VStack gap={10}>
              {status === "draft" ? (
                <Button
                  label="Place order"
                  icon={<Send size={16} color="#FFFFFF" strokeWidth={2} />}
                  loading={statusMut.isPending}
                  onPress={() => statusMut.mutate("placed")}
                />
              ) : null}
              {status === "placed" ? (
                <Button
                  label="Mark received"
                  icon={
                    <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2} />
                  }
                  loading={statusMut.isPending}
                  onPress={() => setReceivedOpen(true)}
                />
              ) : null}
              <Button
                label="Cancel order"
                variant="destructive"
                icon={<Ban size={16} color="#FFFFFF" strokeWidth={2} />}
                loading={statusMut.isPending}
                onPress={() => setCancelOpen(true)}
              />
            </VStack>
          ) : null}

          <Text variant="h3" tone="primary">
            Lines
          </Text>
          <VStack gap={8}>
            {order.lines.map((l, i) => (
              <Card key={i}>
                <HStack gap={10} align="center" justify="space-between">
                  <VStack gap={2} flex={1}>
                    <Text variant="label-lg" tone="primary" numberOfLines={1}>
                      {l.productName}
                    </Text>
                    <Text variant="body-sm" tone="tertiary">
                      {l.sku}
                    </Text>
                  </VStack>
                  <VStack gap={2} align="flex-end">
                    <Text variant="label-lg" tone="primary">
                      {l.quantity}
                    </Text>
                    <Text variant="caption" tone="tertiary">
                      @ {money(l.estimatedPrice)}
                    </Text>
                  </VStack>
                </HStack>
              </Card>
            ))}
          </VStack>
        </VStack>
      )}
      <ConfirmDialog
        visible={cancelOpen}
        title="Cancel this order?"
        message="The distributor will no longer be expected to deliver it. This cannot be undone."
        confirmLabel="Cancel order"
        destructive
        loading={statusMut.isPending}
        onConfirm={() =>
          statusMut.mutate("cancelled", {
            onSettled: () => setCancelOpen(false),
          })
        }
        onCancel={() => setCancelOpen(false)}
      />
      {/*
        "Received" is terminal and irreversible, and it books NO stock — the
        goods still have to be entered through Receive stock. One stray tap
        while reaching for something else closed the order for good and took
        any short-delivered lines off every worklist with it. Cancel already
        asked before doing something permanent; this now does too.
      */}
      <ConfirmDialog
        visible={receivedOpen}
        title="Mark this order as received?"
        message="This closes the order for good — it cannot be reopened or edited afterwards. It does not add anything to stock: enter the goods through Receive stock so batches, expiry and cost are recorded."
        confirmLabel="Mark received"
        loading={statusMut.isPending}
        onConfirm={() =>
          statusMut.mutate("received", {
            onSettled: () => setReceivedOpen(false),
          })
        }
        onCancel={() => setReceivedOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.danger.bg,
    borderWidth: 1,
    borderColor: palette.danger.border,
  },
});
