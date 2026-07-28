import React from "react";
import { useNavigation } from "@react-navigation/native";
import { ShieldCheck, Plus, Mail } from "lucide-react-native";
import { useAdmins } from "@modules/admin/hooks/useAdmin";
import { AdminNav } from "@modules/admin/components/AdminNav";
import { palette } from "@shared/designSystem";
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

export default function AdminsScreen() {
  const navigation = useNavigation<any>();
  const { data: admins, isLoading } = useAdmins();

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

      {!admins || admins.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={isLoading ? "Loading…" : "No admins"}
        />
      ) : (
        <VStack gap={10}>
          {admins.map((a) => (
            <Card
              key={a._id}
              elevation="base"
              onPress={() =>
                navigation.navigate("AdminAdminForm", { id: a._id })
              }
            >
              <HStack gap={10} align="center" justify="space-between">
                <VStack gap={2} flex={1}>
                  <Text variant="label-lg" tone="primary">
                    {a.name}
                  </Text>
                  <HStack gap={6} align="center">
                    <Mail
                      size={14}
                      color={palette.text.tertiary}
                      strokeWidth={1.8}
                    />
                    <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
                      {a.email}
                    </Text>
                  </HStack>
                </VStack>
                <StatusChip
                  label={a.isActive ? "Active" : "Disabled"}
                  tone={a.isActive ? "success" : "danger"}
                />
              </HStack>
            </Card>
          ))}
        </VStack>
      )}
    </Screen>
  );
}
