import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react-native";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { palette, numeric } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  StatRow,
  Pagination,
  EmptyState,
  Skeleton,
  useBreakpoint,
} from "@shared/ui";

export default function ProductLedgerScreen() {
  const route = useRoute<any>();
  const { isWide } = useBreakpoint();
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

  if (isLoading || !data) {
    return (
      <Screen back="Back to product" overline="Inventory" title="Ledger">
        <VStack gap={16}>
          <HStack gap={12} wrap>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ flexGrow: 1, flexBasis: 110 }}>
                <Skeleton height={64} />
              </View>
            ))}
          </HStack>
          <Card>
            <VStack gap={12}>
              {[0, 1, 2, 3, 4].map((i) => (
                <HStack key={i} justify="space-between">
                  <Skeleton width="45%" height={14} />
                  <Skeleton width={40} height={14} />
                </HStack>
              ))}
            </VStack>
          </Card>
        </VStack>
      </Screen>
    );
  }

  return (
    <Screen
      back="Back to product"
      overline="Inventory"
      title={product?.name || "Ledger"}
    >
      {product ? (
        <VStack gap={12} style={{ marginBottom: 16 }}>
          <Text variant="body-sm" tone="tertiary">
            {product.saltComposition || "—"} · {product.brandName || "—"}
          </Text>
          {/* Five product facts on one panel. They used to be five separate
              tiles, two of them filled (green stock, slate HSN) — none of these
              is a status, they are just the product's numbers, so none of them
              gets a colour. Columns are set explicitly because StatRow caps its
              own default at four and would leave a lone cell on a second row. */}
          <StatRow
            columns={isWide ? 5 : 2}
            stats={[
              {
                label: "Current stock",
                value: `${data?.data.currentStock ?? 0} ${product.baseUnit || ""}`,
              },
              {
                label: "Min qty",
                value: String(product.reorderLevel ?? 0),
              },
              { label: "MRP", value: `₹${product.mrp ?? 0}` },
              { label: "GST", value: `${product.taxRatePct ?? 0}%` },
              { label: "HSN", value: product.hsnCode || "—" },
            ]}
          />
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
  row: { paddingVertical: 10, paddingHorizontal: 12 },
  head: { borderBottomWidth: 1, borderBottomColor: palette.border.default },
  divider: { height: 1, backgroundColor: palette.border.subtle },
  cDate: { width: 92 },
  cType: { flex: 1 },
  // In / Out / Close are a column of figures that has to line up down the page,
  // so the tabular variant lives on the column style rather than each cell.
  cNum: { width: 46, textAlign: "right", ...numeric },
  cParty: { flex: 1, textAlign: "right" },
});
