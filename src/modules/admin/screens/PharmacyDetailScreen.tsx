import React from "react";
import { View, Platform, Alert, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  Building2,
  Users,
  Package,
  Receipt,
  Mail,
  Phone,
  ArrowLeft,
  Ban,
  CheckCircle2,
} from "lucide-react-native";
import {
  useAdminOrganization,
  useSetSuspended,
} from "@modules/admin/hooks/useAdmin";
import { apiErrorMessage } from "@shared/api/apiClient";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
  StatTile,
} from "@shared/ui";

function confirm(msg: string, onYes: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(msg)) onYes();
  } else {
    Alert.alert("Please confirm", msg, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: onYes },
    ]);
  }
}

export default function PharmacyDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string;

  const { data: org, isLoading } = useAdminOrganization(id);
  const setSuspended = useSetSuspended();

  return (
    <Screen
      overline="Pharmacy"
      title={org?.name || "Pharmacy"}
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
      {!org ? (
        <Text variant="body-sm" tone="tertiary">
          {isLoading ? "Loading…" : "Pharmacy not found."}
        </Text>
      ) : (
        <VStack gap={16}>
          <Card>
            <VStack gap={14}>
              <HStack gap={12} align="center" justify="space-between">
                <HStack gap={10} align="center" style={{ flex: 1 }}>
                  <View style={styles.orgIcon}>
                    <Building2
                      size={20}
                      color={palette.teal[600]}
                      strokeWidth={2}
                    />
                  </View>
                  <VStack gap={2} flex={1}>
                    <Text variant="h4" tone="primary">
                      {org.name}
                    </Text>
                    <Text variant="body-sm" tone="tertiary">
                      {org.industry} · since{" "}
                      {new Date(org.createdAt).toLocaleDateString("en-IN")}
                    </Text>
                  </VStack>
                </HStack>
                <StatusChip
                  label={org.status === "active" ? "Active" : "Suspended"}
                  tone={org.status === "active" ? "success" : "danger"}
                />
              </HStack>

              {org.owner ? (
                <VStack gap={6}>
                  <Text variant="label" tone="tertiary">
                    Owner (Admin)
                  </Text>
                  <Text variant="body" tone="primary">
                    {org.owner.name}
                  </Text>
                  <HStack gap={6} align="center">
                    <Mail
                      size={14}
                      color={palette.text.tertiary}
                      strokeWidth={1.8}
                    />
                    <Text variant="body-sm" tone="secondary">
                      {org.owner.email}
                    </Text>
                  </HStack>
                  {org.owner.phone ? (
                    <HStack gap={6} align="center">
                      <Phone
                        size={14}
                        color={palette.text.tertiary}
                        strokeWidth={1.8}
                      />
                      <Text variant="body-sm" tone="secondary">
                        {org.owner.phone}
                      </Text>
                    </HStack>
                  ) : null}
                </VStack>
              ) : null}
            </VStack>
          </Card>

          <HStack gap={12} style={{ flexWrap: "wrap" }}>
            <StatTile
              label="Users"
              value={org.stats.users.toLocaleString("en-IN")}
              icon={Users}
              style={styles.tile}
            />
            <StatTile
              label="Products"
              value={org.stats.products.toLocaleString("en-IN")}
              icon={Package}
              style={styles.tile}
            />
            <StatTile
              label="Sales"
              value={org.stats.sales.toLocaleString("en-IN")}
              icon={Receipt}
              style={styles.tile}
            />
          </HStack>

          {setSuspended.isError ? (
            <View style={styles.errorBox}>
              <Text variant="body-sm" tone="danger">
                {apiErrorMessage(setSuspended.error)}
              </Text>
            </View>
          ) : null}

          {org.status === "active" ? (
            <Button
              label="Suspend pharmacy"
              variant="destructive"
              icon={<Ban size={16} color="#FFFFFF" strokeWidth={2} />}
              loading={setSuspended.isPending}
              onPress={() =>
                confirm(
                  "Suspend this pharmacy? All its users will be signed out and unable to log in until reactivated.",
                  () => setSuspended.mutate({ id, suspend: true }),
                )
              }
            />
          ) : (
            <Button
              label="Reactivate pharmacy"
              icon={<CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2} />}
              loading={setSuspended.isPending}
              onPress={() => setSuspended.mutate({ id, suspend: false })}
            />
          )}
        </VStack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  orgIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: palette.teal[50],
    alignItems: "center",
    justifyContent: "center",
  },
  tile: { flexGrow: 1, flexBasis: 140 },
  errorBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.danger.bg,
    borderWidth: 1,
    borderColor: palette.danger.border,
  },
});
