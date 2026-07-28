import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ScrollText } from "lucide-react-native";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { palette } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatTile,
  Pagination,
  EmptyState,
} from "@shared/ui";

export default function ProductLedgerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", "ledger", id, page, limit],
    queryFn: () => inventoryApi.productLedger(id, { page, limit }),
    enabled: Boolean(id),
  });

  const product = data?.data.product;
  const rows = data?.data.rows ?? [];
  const meta = data?.meta;

  return (
    <Screen
      overline="Inventory"
      title={product?.name || "Ledger"}
      right={
        <Button
          label="Back"
          size="sm"
          variant="secondary"
          icon={
            <ArrowLeft
              size={16}
              color={palette.text.secondary}
              strokeWidth={2}
            />
          }
          onPress={() => navigation.goBack()}
        />
      }
    >
      {product ? (
        <VStack gap={12} style={{ marginBottom: 16 }}>
          <Text variant="body-sm" tone="tertiary">
            {product.saltComposition || "—"} · {product.brandName || "—"}
          </Text>
          <HStack gap={12} style={{ flexWrap: "wrap" }}>
            <StatTile
              label="Current stock"
              value={`${data?.data.currentStock ?? 0} ${product.baseUnit || ""}`}
              tone="teal"
              style={styles.tile}
            />
            <StatTile
              label="Min qty"
              value={String(product.reorderLevel ?? 0)}
              style={styles.tile}
            />
            <StatTile
              label="MRP"
              value={`₹${product.mrp ?? 0}`}
              style={styles.tile}
            />
            <StatTile
              label="GST"
              value={`${product.taxRatePct ?? 0}%`}
              style={styles.tile}
            />
            <StatTile
              label="HSN"
              value={product.hsnCode || "—"}
              tone="slate"
              style={styles.tile}
            />
          </HStack>
        </VStack>
      ) : null}

      {/* Ledger table */}
      <Card padded={false} style={{ paddingVertical: 4 }}>
        <HStack gap={8} style={[styles.row, styles.head]}>
          <Text variant="caption" tone="tertiary" style={styles.cDate}>
            Date
          </Text>
          <Text variant="caption" tone="tertiary" style={styles.cType}>
            Transaction
          </Text>
          <Text variant="caption" tone="tertiary" style={styles.cNum}>
            In
          </Text>
          <Text variant="caption" tone="tertiary" style={styles.cNum}>
            Out
          </Text>
          <Text variant="caption" tone="tertiary" style={styles.cNum}>
            Close
          </Text>
          <Text variant="caption" tone="tertiary" style={styles.cParty}>
            Party
          </Text>
        </HStack>

        {rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={isLoading ? "Loading…" : "No transactions yet"}
          />
        ) : (
          rows.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <HStack gap={8} align="center" style={styles.row}>
                <VStack gap={1} style={styles.cDate}>
                  <Text variant="caption" tone="secondary">
                    {new Date(r.date).toLocaleDateString("en-IN")}
                  </Text>
                  {r.batchNumber ? (
                    <Text variant="caption" tone="tertiary" numberOfLines={1}>
                      {r.batchNumber}
                    </Text>
                  ) : null}
                </VStack>
                <Text
                  variant="body-sm"
                  tone="primary"
                  style={styles.cType}
                  numberOfLines={1}
                >
                  {r.type}
                </Text>
                <Text
                  variant="body-sm"
                  style={[styles.cNum, { color: palette.success.text }]}
                >
                  {r.in || ""}
                </Text>
                <Text
                  variant="body-sm"
                  style={[styles.cNum, { color: palette.danger.text }]}
                >
                  {r.out || ""}
                </Text>
                <Text
                  variant="body-sm"
                  weight="600"
                  tone="primary"
                  style={styles.cNum}
                >
                  {r.balance}
                </Text>
                <Text
                  variant="body-sm"
                  tone="secondary"
                  style={styles.cParty}
                  numberOfLines={1}
                >
                  {r.party || "—"}
                </Text>
              </HStack>
            </View>
          ))
        )}
      </Card>

      {meta && meta.total > 0 ? (
        <View style={{ marginTop: 16 }}>
          <Pagination
            page={meta.page}
            totalPages={meta.pages}
            total={meta.total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            label="transactions"
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: 110 },
  row: { paddingVertical: 10, paddingHorizontal: 12 },
  head: { borderBottomWidth: 1, borderBottomColor: palette.border.default },
  divider: { height: 1, backgroundColor: palette.border.subtle },
  cDate: { width: 92 },
  cType: { flex: 1 },
  cNum: { width: 46, textAlign: "right" },
  cParty: { flex: 1, textAlign: "right" },
});
