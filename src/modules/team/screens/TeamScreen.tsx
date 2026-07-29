import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Plus, ChevronRight, ShieldCheck, Users } from "lucide-react-native";
import { useTeamUsers } from "@modules/team/hooks/useTeam";
import { TeamUser } from "@modules/team/types";
import { palette } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Avatar,
  StatusChip,
  Button,
  SearchInput,
  DataTable,
  Column,
  Skeleton,
} from "@shared/ui";

export default function TeamScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch, isRefetching } = useTeamUsers(
    search.trim() ? { search: search.trim() } : undefined,
  );
  const users = data?.data ?? [];

  const open = (u: TeamUser) => navigation.navigate("UserDetail", { id: u.id });

  const columns: Column<TeamUser>[] = [
    {
      key: "fullName",
      header: "Name",
      width: 220,
      sortable: true,
      sortValue: (u) => u.fullName.toLowerCase(),
      render: (u) => (
        <HStack gap={8} align="center">
          <Avatar
            name={u.fullName}
            size={30}
            tone={u.role === "admin" ? "cobalt" : "teal"}
          />
          <Text variant="label" tone="primary" numberOfLines={1}>
            {u.fullName}
          </Text>
          {u.role === "admin" && (
            <ShieldCheck
              size={15}
              color={palette.cobalt[600]}
              strokeWidth={2}
            />
          )}
        </HStack>
      ),
    },
    {
      key: "email",
      header: "Email",
      width: 240,
      sortable: true,
      sortValue: (u) => u.email.toLowerCase(),
      render: (u) => (
        <Text variant="body-sm" tone="secondary" numberOfLines={1}>
          {u.email}
        </Text>
      ),
    },
    {
      key: "role",
      header: "Role",
      width: 150,
      render: (u) => (
        <StatusChip
          label={u.role === "admin" ? "Admin" : u.roleLabel || "Staff"}
          tone={u.role === "admin" ? "info" : "neutral"}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 120,
      render: (u) => (
        <StatusChip
          label={u.isActive ? "Active" : "Disabled"}
          tone={u.isActive ? "success" : "danger"}
        />
      ),
    },
  ];

  return (
    <Screen
      overline="Administration"
      title="Team & Access"
      subtitle={`${data?.meta?.total ?? 0} members · permission-based access`}
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
      right={
        <Button
          label="Add member"
          fullWidth={false}
          icon={<Plus size={18} color="#FFFFFF" strokeWidth={2.2} />}
          onPress={() => navigation.navigate("AddUser")}
        />
      }
    >
      <SearchInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search name, email or role"
      />

      {isLoading && users.length === 0 ? (
        <ListSkeleton />
      ) : (
        <View style={{ marginTop: 16 }}>
          <DataTable<TeamUser>
            columns={columns}
            rows={users}
            keyExtractor={(u) => u.id}
            onRowPress={open}
            mobileCard={(u) => <UserRow user={u} onPress={() => open(u)} />}
            emptyIcon={Users}
            emptyTitle="No members yet"
            emptyMessage="Add staff and assign exactly the permissions they need."
          />
        </View>
      )}
    </Screen>
  );
}

function ListSkeleton() {
  return (
    <VStack gap={12} style={{ marginTop: 16 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Card key={i} elevation="base">
          <HStack gap={14} align="center">
            <Skeleton width={46} height={46} rounded="full" />
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

function UserRow({ user, onPress }: { user: TeamUser; onPress: () => void }) {
  const isAdmin = user.role === "admin";
  return (
    <Card onPress={onPress} elevation="base">
      <HStack gap={14} align="center">
        <Avatar
          name={user.fullName}
          size={46}
          tone={isAdmin ? "cobalt" : "teal"}
        />
        <VStack gap={4} flex={1}>
          <HStack gap={8} align="center">
            <Text variant="label-lg" tone="primary" numberOfLines={1}>
              {user.fullName}
            </Text>
            {isAdmin && (
              <ShieldCheck
                size={15}
                color={palette.cobalt[600]}
                strokeWidth={2}
              />
            )}
          </HStack>
          <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
            {user.email}
          </Text>
          <HStack gap={6} wrap>
            <StatusChip
              label={isAdmin ? "Admin" : user.roleLabel || "Staff"}
              tone={isAdmin ? "info" : "neutral"}
            />
            {!isAdmin && (
              <StatusChip
                label={`${user.permissions.length} permissions`}
                tone="neutral"
              />
            )}
            {!user.isActive && <StatusChip label="Disabled" tone="danger" />}
          </HStack>
        </VStack>
        <ChevronRight size={18} color={palette.text.tertiary} strokeWidth={2} />
      </HStack>
    </Card>
  );
}
