import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Pill, Plus, Search } from "lucide-react-native";
import { useCatalog, useCatalogStats } from "@modules/admin/hooks/useAdmin";
import { AdminNav } from "@modules/admin/components/AdminNav";
import type { CatalogProduct } from "@modules/admin/types";
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
  DataTable,
  Column,
  Skeleton,
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

  const open = (p: CatalogProduct) =>
    navigation.navigate("AdminCatalogForm", { id: p._id });

  const columns: Column<CatalogProduct>[] = [
    {
      key: "name",
      header: "Product",
      width: 220,
      sortable: true,
      sortValue: (p) => (p.name || "").toLowerCase(),
      render: (p) => (
        <Text variant="label" tone="primary" numberOfLines={1}>
          {p.name}
        </Text>
      ),
    },
    {
      key: "saltComposition",
      header: "Salt / Manufacturer",
      width: 260,
      sortable: true,
      sortValue: (p) => (p.saltComposition || "").toLowerCase(),
      render: (p) => (
        <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
          {p.saltComposition || "—"} · {p.manufacturerName || "—"}
        </Text>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      width: 150,
      sortable: true,
      sortValue: (p) => (p.sku || "").toLowerCase(),
      render: (p) => (
        <Text variant="body-sm" tone="secondary" numberOfLines={1}>
          {p.sku || "—"}
        </Text>
      ),
    },
    {
      key: "mrp",
      header: "MRP",
      width: 100,
      align: "right",
      sortable: true,
      sortValue: (p) => p.mrp,
      render: (p) => (
        <Text variant="label" weight="600" tone="secondary">
          ₹{p.mrp}
        </Text>
      ),
    },
    {
      key: "packLabel",
      header: "Pack",
      width: 150,
      render: (p) => (
        <HStack gap={6} align="center" wrap>
          <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
            {p.packLabel || "—"}
          </Text>
          {p.prescriptionRequired ? (
            <StatusChip label="Rx" tone="warning" />
          ) : null}
        </HStack>
      ),
    },
  ];

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

      {isLoading && items.length === 0 ? (
        <ListSkeleton />
      ) : (
        <View>
          <DataTable<CatalogProduct>
            columns={columns}
            rows={items}
            keyExtractor={(p) => p._id}
            onRowPress={open}
            mobileCard={(p) => (
              <CatalogRow product={p} onPress={() => open(p)} />
            )}
            emptyIcon={Pill}
            emptyTitle="No products found"
          />
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
        </View>
      )}
    </Screen>
  );
}

function ListSkeleton() {
  return (
    <VStack gap={12}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Card key={i} elevation="base">
          <HStack gap={14} align="center">
            <VStack gap={6} flex={1}>
              <Skeleton width="40%" height={16} />
              <Skeleton width="70%" height={12} />
            </VStack>
            <Skeleton width={70} height={16} />
          </HStack>
        </Card>
      ))}
    </VStack>
  );
}

function CatalogRow({
  product,
  onPress,
}: {
  product: CatalogProduct;
  onPress: () => void;
}) {
  return (
    <Card elevation="base" onPress={onPress}>
      <HStack gap={10} align="center" justify="space-between">
        <VStack gap={2} flex={1}>
          <Text variant="label-lg" tone="primary" numberOfLines={1}>
            {product.name}
          </Text>
          <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
            {product.saltComposition || "—"} · {product.manufacturerName || "—"}
          </Text>
        </VStack>
        <VStack gap={4} align="flex-end">
          <Text variant="label" weight="600" tone="secondary">
            ₹{product.mrp}
          </Text>
          {product.prescriptionRequired ? (
            <StatusChip label="Rx" tone="warning" />
          ) : null}
        </VStack>
      </HStack>
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: 150 },
});
