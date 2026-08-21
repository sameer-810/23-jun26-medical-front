import React, { useState } from "react";
import { View } from "react-native";
import { useRoute } from "@react-navigation/native";
import { Printer, Undo2, MapPin, MessageCircle } from "lucide-react-native";
import { useSale, useInvoiceProfile } from "@modules/sale/hooks/useSales";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { printInvoice } from "@modules/sale/invoice";
import { sendWhatsApp } from "@shared/whatsapp";
import { fmtMoneyExact, fmtDate, fmtDateTime } from "@shared/format";
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
} from "@shared/ui";
import { ReturnModal } from "@modules/sale/components/ReturnModal";

const STATUS_TONE = {
  completed: "success",
  partially_returned: "warning",
  returned: "danger",
} as const;

export default function SaleDetailScreen() {
  const route = useRoute<any>();
  const id = route.params?.id as string;
  const { data: sale, isLoading } = useSale(id);
  const { data: profile } = useInvoiceProfile();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canReturn = hasPermission(PERMISSIONS.SALES_MANAGE);
  const shopName = useAuthStore((s) => s.organization?.name) || "Pharmacy";
  const [returnOpen, setReturnOpen] = useState(false);

  if (isLoading || !sale) {
    return (
      <Screen back="Back to sales" overline="Sales" title="Invoice">
        <VStack gap={12}>
          <Skeleton width={180} height={28} />
          <Card>
            <VStack gap={12}>
              <Skeleton width="60%" height={18} />
              <Skeleton width="40%" height={14} />
              <Skeleton height={1} />
              {[0, 1, 2].map((i) => (
                <HStack key={i} justify="space-between">
                  <Skeleton width="45%" height={14} />
                  <Skeleton width={70} height={14} />
                </HStack>
              ))}
            </VStack>
          </Card>
          <Card>
            <VStack gap={10}>
              <Skeleton width="30%" height={16} />
              <Skeleton width="80%" height={14} />
              <Skeleton width="70%" height={14} />
            </VStack>
          </Card>
        </VStack>
      </Screen>
    );
  }

  const intra = sale.taxType === "intra";
  const fullyReturned = sale.status === "returned";

  const waInvoice = () => {
    const items = sale.lines
      .map(
        (l) =>
          `• ${l.productName} × ${l.quantity} ${l.unit} = ${fmtMoneyExact(l.lineTotal)}`,
      )
      .join("\n");
    return `*${shopName}*\nInvoice ${sale.invoiceNo}\n${fmtDate(
      sale.saleDate,
    )}\n\n${items}\n\n*Total: ${fmtMoneyExact(
      sale.grandTotal,
    )}*\nThank you for your visit!`;
  };

  return (
    <Screen
      back="Back to sales"
      overline={`Invoice · ${sale.status.replace("_", " ")}`}
      title={sale.invoiceNo}
      subtitle={fmtDateTime(sale.saleDate)}
    >
      <HStack
        justify="space-between"
        align="center"
        style={{ marginBottom: 16 }}
        wrap
      >
        <HStack gap={10}>
          {sale.customerMobile ? (
            <Button
              label="WhatsApp"
              variant="secondary"
              fullWidth={false}
              icon={
                <MessageCircle
                  size={16}
                  color={palette.success.text}
                  strokeWidth={2}
                />
              }
              onPress={() => sendWhatsApp(sale.customerMobile, waInvoice())}
            />
          ) : null}
          <Button
            label="Print"
            variant="secondary"
            fullWidth={false}
            icon={
              <Printer size={16} color={palette.text.primary} strokeWidth={2} />
            }
            onPress={() => printInvoice(sale, profile)}
          />
          {canReturn && !fullyReturned && (
            <Button
              label="Return"
              variant="secondary"
              fullWidth={false}
              icon={
                <Undo2 size={16} color={palette.text.primary} strokeWidth={2} />
              }
              onPress={() => setReturnOpen(true)}
            />
          )}
        </HStack>
      </HStack>

      {/* Customer + status */}
      <Card style={{ marginBottom: 16 }}>
        <HStack justify="space-between" align="flex-start">
          <VStack gap={3}>
            <Text variant="caption" tone="tertiary">
              Bill to
            </Text>
            <Text variant="label-lg" tone="primary">
              {sale.customerName}
            </Text>
            {sale.customerMobile ? (
              <Text variant="body-sm" tone="tertiary">
                {sale.customerMobile}
              </Text>
            ) : null}
            {sale.customerGstin ? (
              <Text variant="caption" tone="tertiary">
                GSTIN {sale.customerGstin}
              </Text>
            ) : null}
          </VStack>
          <VStack gap={6} align="flex-end">
            <StatusChip
              label={sale.status.replace("_", " ")}
              tone={STATUS_TONE[sale.status]}
            />
            <StatusChip label={intra ? "CGST+SGST" : "IGST"} tone="neutral" />
            {sale.paymentMode ? (
              <StatusChip label={sale.paymentMode} tone="info" />
            ) : null}
          </VStack>
        </HStack>
      </Card>

      {/* Lines */}
      <VStack gap={12}>
        {sale.lines.map((l) => (
          <Card key={l.id} elevation="base">
            <VStack gap={8}>
              <HStack justify="space-between" align="flex-start">
                <VStack gap={2} flex={1}>
                  <Text variant="label-lg" tone="primary" numberOfLines={1}>
                    {l.productName}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    {l.sku}
                    {l.hsnCode ? ` · HSN ${l.hsnCode}` : ""}
                  </Text>
                </VStack>
                <Text variant="label-lg" tone="primary">
                  {fmtMoneyExact(l.lineTotal)}
                </Text>
              </HStack>
              <Text variant="body-sm" tone="secondary">
                {l.quantity} {l.unit} × {fmtMoneyExact(l.unitPrice)}
                {l.discountAmount
                  ? ` − ${fmtMoneyExact(l.discountAmount)} disc`
                  : ""}{" "}
                · GST {l.taxRatePct}%
              </Text>
              {/* FEFO batch allocations */}
              <HStack gap={6} wrap>
                {l.allocations.map((a, idx) => (
                  <View key={idx} style={styles.alloc}>
                    <MapPin
                      size={12}
                      color={palette.teal[600]}
                      strokeWidth={2}
                    />
                    <Text variant="label-sm" tone="secondary">
                      {a.batchNumber} @ {a.locationCode} · {a.baseQty}
                    </Text>
                  </View>
                ))}
              </HStack>
              {l.returnedBaseQty > 0 && (
                <StatusChip
                  label={`Returned ${l.returnedBaseQty}`}
                  tone="danger"
                />
              )}
            </VStack>
          </Card>
        ))}
      </VStack>

      {/* Totals */}
      <Card style={{ marginTop: 16 }}>
        <VStack gap={8}>
          <Row label="Subtotal" value={fmtMoneyExact(sale.subtotal)} />
          {sale.totalDiscount > 0 && (
            <Row
              label="Discount"
              value={`- ${fmtMoneyExact(sale.totalDiscount)}`}
            />
          )}
          <Row label="Taxable" value={fmtMoneyExact(sale.totalTaxable)} />
          {intra ? (
            <>
              <Row label="CGST" value={fmtMoneyExact(sale.totalCgst)} muted />
              <Row label="SGST" value={fmtMoneyExact(sale.totalSgst)} muted />
            </>
          ) : (
            <Row label="IGST" value={fmtMoneyExact(sale.totalIgst)} muted />
          )}
          {sale.roundOff !== 0 && (
            <Row label="Round off" value={fmtMoneyExact(sale.roundOff)} muted />
          )}
          <View
            style={{
              height: 1,
              backgroundColor: palette.border.default,
              marginVertical: 4,
            }}
          />
          <HStack justify="space-between" align="center">
            <Text variant="h3" tone="primary">
              Grand total
            </Text>
            <Text variant="h2" tone="accent">
              {fmtMoneyExact(sale.grandTotal)}
            </Text>
          </HStack>
          {sale.totalReturned > 0 && (
            <Row
              label="Refunded"
              value={`- ${fmtMoneyExact(sale.totalReturned)}`}
            />
          )}
        </VStack>
      </Card>

      {/* Returns history */}
      {sale.returns && sale.returns.length > 0 && (
        <>
          <Text
            variant="h3"
            tone="primary"
            style={{ marginTop: 24, marginBottom: 12 }}
          >
            Credit notes
          </Text>
          <VStack gap={12}>
            {sale.returns.map((r) => (
              <Card key={r.id} elevation="base">
                <HStack justify="space-between" align="center">
                  <VStack gap={2}>
                    <Text variant="label-lg" tone="primary">
                      {r.returnNo}
                    </Text>
                    <Text variant="caption" tone="tertiary">
                      {fmtDate(r.createdAt)}
                      {r.reason ? ` · ${r.reason}` : ""}
                    </Text>
                  </VStack>
                  <Text variant="label-lg" tone="danger">
                    - {fmtMoneyExact(r.totalRefund)}
                  </Text>
                </HStack>
              </Card>
            ))}
          </VStack>
        </>
      )}

      <ReturnModal
        visible={returnOpen}
        sale={sale}
        onClose={() => setReturnOpen(false)}
      />
    </Screen>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <HStack justify="space-between">
      <Text variant="body-sm" tone={muted ? "tertiary" : "secondary"}>
        {label}
      </Text>
      <Text variant="label" tone={muted ? "tertiary" : "primary"}>
        {value}
      </Text>
    </HStack>
  );
}

const styles = {
  alloc: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: palette.teal[50],
  },
};
