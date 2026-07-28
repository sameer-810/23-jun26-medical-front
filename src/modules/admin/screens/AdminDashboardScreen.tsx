import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Building2,
  Plus,
  Users,
  Package,
  Receipt,
  Search,
} from "lucide-react-native";
import {
  useAdminOverview,
  useAdminOrganizations,
} from "@modules/admin/hooks/useAdmin";
import { AdminNav } from "@modules/admin/components/AdminNav";
import type { AdminOrg } from "@modules/admin/types";
import { palette, radius } from "@shared/designSystem";
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

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: overview } = useAdminOverview();
  const { data, isLoading } = useAdminOrganizations({ page, limit, search });
  const orgs = data?.data ?? [];
  const meta = data?.meta;

  const onSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  return (
    <Screen
      overline="Platform"
      title="Pharmacies"
      right={
        <Button
          label="Add pharmacy"
          size="sm"
          icon={<Plus size={16} color="#FFFFFF" strokeWidth={2.2} />}
          onPress={() => navigation.navigate("AdminCreatePharmacy")}
        />
      }
    >
      <AdminNav active="pharmacies" />

      {/* Platform overview */}
      <HStack gap={12} style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <StatTile
          label="Total pharmacies"
          value={String(overview?.totalOrgs ?? "—")}
          icon={Building2}
          tone="teal"
          style={styles.tile}
        />
        <StatTile
          label="Active"
          value={String(overview?.activeOrgs ?? "—")}
          tone="light"
          style={styles.tile}
        />
        <StatTile
          label="Suspended"
          value={String(overview?.suspendedOrgs ?? "—")}
          tone="light"
          style={styles.tile}
        />
        <StatTile
          label="Total users"
          value={String(overview?.totalUsers ?? "—")}
          icon={Users}
          tone="slate"
          style={styles.tile}
        />
      </HStack>

      {/* Search */}
      <View style={{ marginBottom: 12 }}>
        <TextField
          value={search}
          onChangeText={onSearch}
          placeholder="Search pharmacies by name"
          leading={
            <Search size={18} color={palette.text.tertiary} strokeWidth={1.8} />
          }
          autoCapitalize="none"
        />
      </View>

      {/* List */}
      {orgs.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={isLoading ? "Loading…" : "No pharmacies found"}
        />
      ) : (
        <VStack gap={10}>
          {orgs.map((o) => (
            <PharmacyRow
              key={o.id}
              org={o}
              onPress={() =>
                navigation.navigate("AdminPharmacyDetail", { id: o.id })
              }
            />
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
            label="pharmacies"
          />
        </View>
      ) : null}
    </Screen>
  );
}

function PharmacyRow({ org, onPress }: { org: AdminOrg; onPress: () => void }) {
  return (
    <Card elevation="base" onPress={onPress}>
      <VStack gap={10}>
        <HStack gap={10} align="center" justify="space-between">
          <HStack gap={10} align="center" style={{ flex: 1 }}>
            <View style={styles.orgIcon}>
              <Building2 size={18} color={palette.teal[600]} strokeWidth={2} />
            </View>
            <VStack gap={2} flex={1}>
              <Text variant="label-lg" tone="primary" numberOfLines={1}>
                {org.name}
              </Text>
              <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
                {org.owner?.email || "No owner"}
              </Text>
            </VStack>
          </HStack>
          <StatusChip
            label={org.status === "active" ? "Active" : "Suspended"}
            tone={org.status === "active" ? "success" : "danger"}
          />
        </HStack>
        <HStack gap={16}>
          <MiniStat icon={Users} label="Users" value={org.stats.users} />
          <MiniStat
            icon={Package}
            label="Products"
            value={org.stats.products}
          />
          <MiniStat icon={Receipt} label="Sales" value={org.stats.sales} />
        </HStack>
      </VStack>
    </Card>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <HStack gap={6} align="center">
      <Icon size={14} color={palette.text.tertiary} strokeWidth={1.8} />
      <Text variant="body-sm" tone="secondary">
        {value.toLocaleString("en-IN")} {label}
      </Text>
    </HStack>
  );
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: 160 },
  orgIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: palette.teal[50],
    alignItems: "center",
    justifyContent: "center",
  },
});
