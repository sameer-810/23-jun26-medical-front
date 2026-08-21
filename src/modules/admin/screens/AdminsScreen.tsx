import React from "react";
import { useNavigation } from "@react-navigation/native";
import { ShieldCheck, Plus, Mail } from "lucide-react-native";
import { useAdmins } from "@modules/admin/hooks/useAdmin";
import { AdminNav } from "@modules/admin/components/AdminNav";
import type { PlatformAdminRow } from "@modules/admin/types";
import { palette } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
  DataTable,
  Column,
  Skeleton,
  ErrorState,
} from "@shared/ui";

export default function AdminsScreen() {
  const navigation = useNavigation<any>();
  const {
    data: admins,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useAdmins();
  const items = admins ?? [];

  const open = (a: PlatformAdminRow) =>
    navigation.navigate("AdminAdminForm", { id: a._id });

  const columns: Column<PlatformAdminRow>[] = [
    {
      key: "name",
      header: "Name",
      width: 200,
      sortable: true,
      sortValue: (a) => (a.name || "").toLowerCase(),
      render: (a) => (
        <Text variant="label" tone="primary">
          {a.name}
        </Text>
      ),
    },
    {
      key: "email",
      header: "Email",
      width: 280,
      sortable: true,
      sortValue: (a) => (a.email || "").toLowerCase(),
      render: (a) => (
        <HStack gap={6} align="center">
          <Mail size={14} color={palette.text.tertiary} strokeWidth={1.8} />
          <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
            {a.email}
          </Text>
        </HStack>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      width: 120,
      render: (a) => (
        <StatusChip
          label={a.isActive ? "Active" : "Disabled"}
          tone={a.isActive ? "success" : "danger"}
        />
      ),
    },
  ];

  return (
    <Screen
      overline="Platform"
      title="Platform admins"
      right={
        <Button
          label="Add admin"
          size="sm"
          icon={<Plus size={16} color="#FFFFFF" strokeWidth={2.2} />}
          onPress={() => navigation.navigate("AdminAdminForm", {})}
        />
      }
    >
      <AdminNav active="admins" />

      {isError ? (
        <ErrorState
          error={error}
          title="Couldn't load the platform admins"
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      ) : isLoading && items.length === 0 ? (
        <ListSkeleton />
      ) : (
        <DataTable<PlatformAdminRow>
          columns={columns}
          rows={items}
          keyExtractor={(a) => a._id}
          onRowPress={open}
          pageSize={25}
          mobileCard={(a) => <AdminRow admin={a} onPress={() => open(a)} />}
          emptyIcon={ShieldCheck}
          emptyTitle="No admins"
        />
      )}
    </Screen>
  );
}

function ListSkeleton() {
  return (
    <VStack gap={10}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Card key={i} elevation="base">
          <HStack gap={10} align="center" justify="space-between">
            <VStack gap={6} flex={1}>
              <Skeleton width="35%" height={16} />
              <Skeleton width="60%" height={12} />
            </VStack>
            <Skeleton width={70} height={16} />
          </HStack>
        </Card>
      ))}
    </VStack>
  );
}

function AdminRow({
  admin,
  onPress,
}: {
  admin: PlatformAdminRow;
  onPress: () => void;
}) {
  return (
    <Card elevation="base" onPress={onPress}>
      <HStack gap={10} align="center" justify="space-between">
        <VStack gap={2} flex={1}>
          <Text variant="label-lg" tone="primary">
            {admin.name}
          </Text>
          <HStack gap={6} align="center">
            <Mail size={14} color={palette.text.tertiary} strokeWidth={1.8} />
            <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
              {admin.email}
            </Text>
          </HStack>
        </VStack>
        <StatusChip
          label={admin.isActive ? "Active" : "Disabled"}
          tone={admin.isActive ? "success" : "danger"}
        />
      </HStack>
    </Card>
  );
}
