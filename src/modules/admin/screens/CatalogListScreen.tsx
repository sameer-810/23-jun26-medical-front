import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Pill, Plus, Search } from "lucide-react-native";
import { useCatalog, useCatalogStats } from "@modules/admin/hooks/useAdmin";
import { AdminNav } from "@modules/admin/components/AdminNav";
import { palette } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatTile,
  StatusChip,
  TextField,
  Pagination,
  EmptyState,
} from "@shared/ui";

export default function CatalogListScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: stats } = useCatalogStats();
  const { data, isLoading } = useCatalog({ page, limit, search });
  const items = data?.data ?? [];
  const meta = data?.meta;

  return (
    <Screen
      overline="Platform"
      title="Catalogue"
      right={
        <Button
          label="Add product"
          size="sm"
          icon={<Plus size={16} color="#FFFFFF" strokeWidth={2.2} />}
          onPress={() => navigation.navigate("AdminCatalogForm", {})}
        />
      }
    >
      <AdminNav active="catalog" />

      <HStack gap={12} style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <StatTile
          label="Products"
          value={(stats?.total ?? 0).toLocaleString("en-IN")}
          icon={Pill}
          tone="teal"
          style={styles.tile}
        />
        <StatTile
          label="Active"
          value={(stats?.active ?? 0).toLocaleString("en-IN")}
          style={styles.tile}
        />
        <StatTile
          label="With images"
          value={(stats?.withImages ?? 0).toLocaleString("en-IN")}
          style={styles.tile}
        />
        <StatTile
          label="With clinical"
          value={(stats?.withClinical ?? 0).toLocaleString("en-IN")}
          tone="slate"
          style={styles.tile}
        />
      </HStack>

      <View style={{ marginBottom: 12 }}>
        <TextField
          value={search}
          onChangeText={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name, salt or manufacturer"
          leading={
            <Search size={18} color={palette.text.tertiary} strokeWidth={1.8} />
          }
          autoCapitalize="none"
        />
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon={Pill}
          title={isLoading ? "Loading…" : "No products found"}
        />
      ) : (
        <VStack gap={8}>
          {items.map((p) => (
            <Card
              key={p._id}
              elevation="base"
              onPress={() =>
                navigation.navigate("AdminCatalogForm", { id: p._id })
              }
            >
              <HStack gap={10} align="center" justify="space-between">
                <VStack gap={2} flex={1}>
                  <Text variant="label-lg" tone="primary" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
                    {p.saltComposition || "—"} · {p.manufacturerName || "—"}
                  </Text>
                </VStack>
                <VStack gap={4} align="flex-end">
                  <Text variant="label" weight="600" tone="secondary">
                    ₹{p.mrp}
                  </Text>
                  {p.prescriptionRequired ? (
                    <StatusChip label="Rx" tone="warning" />
                  ) : null}
                </VStack>
              </HStack>
            </Card>
          ))}
        </VStack>
      )}

      {meta && meta.total > 0 ? (
        <View style={{ marginTop: 16 }}>
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            label="products"
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: 150 },
});
