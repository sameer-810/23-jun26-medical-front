/**
 * Return by scan (client Feature 2B).
 *
 * The customer hands back a pack; the pharmacist scans its shelf label. The
 * label names the LOT, the lot names the invoices that sold from it, and
 * the pharmacist picks the right one — the return form then opens with
 * that line already selected, and the stock goes back to the exact rack it
 * was sold from (the server has always done that part).
 *
 * A product barcode isn't enough: it says WHICH medicine, not WHICH lot,
 * and a return must land on the batch it left from. The message says so.
 */
import React, { useState } from "react";
import { View, Modal, Pressable, ScrollView, StyleSheet } from "react-native";
import { X, ScanLine, ChevronRight } from "lucide-react-native";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { saleApi } from "@modules/sale/api/saleApi";
import { ScanReturnMatch } from "@modules/sale/types";
import { useScanGun } from "@shared/useScanGun";
import { apiErrorMessage } from "@api/apiClient";
import { fmtMoney, fmtDate } from "@shared/format";
import { palette, radius, shadows } from "@shared/designSystem";
import {
  Text,
  VStack,
  HStack,
  TextField,
  Banner,
  StatusChip,
  Skeleton,
} from "@shared/ui";

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (saleId: string, matchedLineIds: string[]) => void;
}

export function ScanReturnModal({ visible, onClose, onPick }: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [lot, setLot] = useState<{ batchNumber: string; product: string } | null>(
    null,
  );
  const [matches, setMatches] = useState<ScanReturnMatch[] | null>(null);

  const resolve = async (raw: string) => {
    const scanned = raw.trim();
    setCode("");
    if (!scanned) return;
    setBusy(true);
    setNote(null);
    setMatches(null);
    try {
      const res = await inventoryApi.scan(scanned);
      if (res.kind !== "batch" || !res.batch) {
        setNote(
          `"${scanned}" is a product barcode — it says which medicine, not which lot. Scan the pack's shelf label (the batch sticker) instead.`,
        );
        return;
      }
      setLot({
        batchNumber: res.batch.batchNumber,
        product: res.product?.name || "",
      });
      const found = await saleApi.byBatch(res.batch.id);
      setMatches(found);
      if (!found.length) {
        setNote(
          `No open invoice sold from lot ${res.batch.batchNumber}. It may have been fully returned already, or sold before this lot was labelled.`,
        );
      }
    } catch (e) {
      setNote(apiErrorMessage(e, "Nothing matches that code"));
    } finally {
      setBusy(false);
    }
  };

  // USB gun while the dialog is open; the visible box handles its own Enter.
  useScanGun((c) => void resolve(c), {
    enabled: visible,
    ignoreSelector: "#return-scan",
  });

  const close = () => {
    setMatches(null);
    setLot(null);
    setNote(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <HStack align="center" justify="space-between" style={{ marginBottom: 12 }}>
            <VStack gap={0} flex={1}>
              <Text variant="h3" tone="primary">
                Return by scan
              </Text>
              <Text variant="caption" tone="tertiary">
                Scan the pack&apos;s shelf label to find the invoice it was sold on
              </Text>
            </VStack>
            <Pressable onPress={close} hitSlop={8} accessibilityLabel="Close">
              <X size={20} color={palette.text.tertiary} strokeWidth={2} />
            </Pressable>
          </HStack>

          <TextField
            nativeID="return-scan"
            value={code}
            onChangeText={setCode}
            onSubmitEditing={() => void resolve(code)}
            blurOnSubmit={false}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Scan or type the label code, then Enter"
            leading={
              <ScanLine size={18} color={palette.teal[600]} strokeWidth={2} />
            }
          />

          {note ? (
            <Banner tone="warning" message={note} style={{ marginTop: 12 }} />
          ) : null}

          {busy ? (
            <VStack gap={8} style={{ marginTop: 12 }}>
              <Skeleton height={48} />
              <Skeleton height={48} />
            </VStack>
          ) : null}

          {lot && matches && matches.length > 0 ? (
            <View style={{ marginTop: 12 }}>
              <Text variant="label" tone="secondary" style={{ marginBottom: 6 }}>
                Lot {lot.batchNumber}
                {lot.product ? ` · ${lot.product}` : ""} — sold on:
              </Text>
              <ScrollView style={{ maxHeight: 320 }}>
                {matches.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => onPick(m.id, m.matchedLineIds)}
                    style={styles.row}
                    accessibilityRole="button"
                    accessibilityLabel={`Return against ${m.invoiceNo}`}
                  >
                    <VStack gap={2} flex={1}>
                      <HStack gap={8} align="center">
                        <Text variant="label" tone="primary">
                          {m.invoiceNo}
                        </Text>
                        {m.status !== "completed" ? (
                          <StatusChip
                            tone="warning"
                            label={m.status.replace("_", " ")}
                          />
                        ) : null}
                      </HStack>
                      <Text variant="caption" tone="tertiary" numberOfLines={1}>
                        {m.customerName}
                        {m.customerMobile ? ` · ${m.customerMobile}` : ""} ·{" "}
                        {fmtDate(m.saleDate)} · {fmtMoney(m.grandTotal)}
                      </Text>
                    </VStack>
                    <ChevronRight
                      size={18}
                      color={palette.text.tertiary}
                      strokeWidth={2}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    padding: 20,
    ...shadows.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
});
