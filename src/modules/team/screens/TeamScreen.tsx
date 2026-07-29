import React, { useState } from "react";
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
  EmptyState,
} from "@shared/ui";

export default function TeamScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch, isRefetching } = useTeamUsers(
    search.trim() ? { search: search.trim() } : undefined,
  );
  const users = data?.data ?? [];

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

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title={isLoading ? "Loading team…" : "No members yet"}
          message="Add staff and assign exactly the permissions they need."
        />
      ) : (
        <VStack gap={12} style={{ marginTop: 16 }}>
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              onPress={() => navigation.navigate("UserDetail", { id: u.id })}
            />
          ))}
        </VStack>
      )}
    </Screen>
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
