import React, { useState } from "react";
import { View, Platform, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ArrowLeft, UserRound, KeyRound } from "lucide-react-native";
import {
  useOrgUsers,
  useResetUserPassword,
  useSetUserActive,
} from "@modules/admin/hooks/useAdmin";
import { AdminNav } from "@modules/admin/components/AdminNav";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
  EmptyState,
} from "@shared/ui";

export default function PharmacyUsersScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string;

  const { data: users, isLoading } = useOrgUsers(id);
  const resetPw = useResetUserPassword(id);
  const setActive = useSetUserActive(id);
  const [msg, setMsg] = useState<string | null>(null);

  const doReset = (userId: string, name: string) => {
    if (Platform.OS !== "web") return;
    const pw = window.prompt(`New password for ${name} (min 8 chars):`);
    if (!pw) return;
    if (pw.length < 8) {
      setMsg("Password must be at least 8 characters.");
      return;
    }
    resetPw.mutate(
      { userId, password: pw },
      { onSuccess: () => setMsg(`Password reset for ${name}.`) },
    );
  };

  return (
    <Screen
      overline="Pharmacy"
      title="Users"
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
      <AdminNav active="pharmacies" />

      {msg ? (
        <View style={styles.infoBox}>
          <Text variant="body-sm" tone="secondary">
            {msg}
          </Text>
        </View>
      ) : null}

      {!users || users.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title={isLoading ? "Loading…" : "No users"}
        />
      ) : (
        <VStack gap={10}>
          {users.map((u) => {
            const name = `${u.firstName} ${u.lastName}`.trim() || u.email;
            return (
              <Card key={u._id}>
                <VStack gap={10}>
                  <HStack gap={10} align="center" justify="space-between">
                    <VStack gap={2} flex={1}>
                      <Text variant="label-lg" tone="primary" numberOfLines={1}>
                        {name}
                      </Text>
                      <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
                        {u.email} · {u.roleLabel || u.role}
                      </Text>
                    </VStack>
                    <StatusChip
                      label={u.isActive ? "Active" : "Disabled"}
                      tone={u.isActive ? "success" : "danger"}
                    />
                  </HStack>
                  <HStack gap={10}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Reset password"
                        size="sm"
                        variant="secondary"
                        icon={
                          <KeyRound
                            size={14}
                            color={palette.text.secondary}
                            strokeWidth={2}
                          />
                        }
                        loading={resetPw.isPending}
                        onPress={() => doReset(u._id, name)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={u.isActive ? "Deactivate" : "Activate"}
                        size="sm"
                        variant={u.isActive ? "destructive" : "primary"}
                        loading={setActive.isPending}
                        onPress={() =>
                          setActive.mutate({
                            userId: u._id,
                            isActive: !u.isActive,
                          })
                        }
                      />
                    </View>
                  </HStack>
                </VStack>
              </Card>
            );
          })}
        </VStack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  infoBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.surface.secondary,
    borderWidth: 1,
    borderColor: palette.border.subtle,
    marginBottom: 12,
  },
});
