import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Plus, ChevronRight, ShieldCheck, Users } from "lucide-react-native";
import {
  useTeamUsers,
  useTeamLimits,
  useUpdateTeamLimits,
} from "@modules/team/hooks/useTeam";
import { TeamUser } from "@modules/team/types";
import { useAuthStore } from "@shared/store/useAuthStore";
import { apiErrorMessage } from "@api/apiClient";
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
  TextField,
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
      width: 160,
      render: (u) => (
        <Text variant="body-sm" tone="secondary" numberOfLines={1}>
          {u.role === "admin" ? "Admin" : u.roleLabel || "Staff"}
        </Text>
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
      <LimitsCard />

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
          size={32}
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

/**
 * The two limits this pharmacy controls.
 *
 * Kept on Team & Access rather than Settings because this is where an admin is
 * standing when they wonder why they can't add another member. Both numbers
 * show the plan's ceiling beside them, so "why can't I set 10?" is answered on
 * the screen instead of by a support message.
 */
function LimitsCard() {
  const { data, isLoading } = useTeamLimits();
  const mut = useUpdateTeamLimits();
  const [users, setUsers] = useState<string | null>(null);
  const [devices, setDevices] = useState<string | null>(null);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  if (!isAdmin || isLoading || !data) return null;

  // Unedited fields show the saved value; a typed one wins until saved.
  const userVal = users ?? String(data.users.current || "");
  const deviceVal = devices ?? String(data.devices.current || "");
  const cap = (n: number) =>
    n > 0 ? `plan allows up to ${n}` : "no plan limit";

  const save = () => {
    const payload: { maxUsers?: number; maxDevicesPerUser?: number } = {};
    if (users !== null) payload.maxUsers = Number(users) || 0;
    if (devices !== null) payload.maxDevicesPerUser = Number(devices) || 0;
    if (!Object.keys(payload).length) return;
    mut.mutate(payload, {
      onSuccess: () => {
        setUsers(null);
        setDevices(null);
      },
    });
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <VStack gap={14}>
        <HStack justify="space-between" align="center" wrap gap={8}>
          <VStack gap={2}>
            <Text variant="label-lg" tone="primary">
              Limits for this pharmacy
            </Text>
            <Text variant="caption" tone="tertiary">
              {data.usersInUse} member{data.usersInUse === 1 ? "" : "s"} in use
              {data.users.current > 0
                ? ` of ${data.users.current} allowed`
                : ""}
            </Text>
          </VStack>
          <Button
            label="Save limits"
            variant="secondary"
            size="sm"
            fullWidth={false}
            loading={mut.isPending}
            disabled={users === null && devices === null}
            onPress={save}
          />
        </HStack>

        <HStack gap={12} wrap>
          <View style={{ flex: 1, minWidth: 200 }}>
            <TextField
              label="Total members"
              value={userVal}
              onChangeText={setUsers}
              keyboardType="number-pad"
              placeholder="0"
              hint={`0 = follow the plan · ${cap(data.users.ceiling)}`}
            />
          </View>
          <View style={{ flex: 1, minWidth: 200 }}>
            <TextField
              label="Devices each member may sign in on"
              value={deviceVal}
              onChangeText={setDevices}
              keyboardType="number-pad"
              placeholder="0"
              hint={`0 = follow the plan · ${cap(data.devices.ceiling)}`}
            />
          </View>
        </HStack>

        {mut.isError ? (
          <Text variant="caption" tone="danger">
            {apiErrorMessage(mut.error)}
          </Text>
        ) : null}
        {mut.isSuccess && users === null && devices === null ? (
          <Text variant="caption" tone="success">
            Limits saved.
          </Text>
        ) : null}
      </VStack>
    </Card>
  );
}
