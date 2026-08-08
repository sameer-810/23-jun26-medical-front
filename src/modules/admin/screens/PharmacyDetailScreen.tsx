import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  Building2,
  Users,
  Package,
  Receipt,
  Mail,
  Phone,
  Ban,
  CheckCircle2,
  Pencil,
  UsersRound,
  Trash2,
  CreditCard,
  MonitorSmartphone,
} from "lucide-react-native";
import {
  useAdminOrganization,
  useOrgSessions,
  useRevokeOrgSessions,
  useSetSuspended,
  useArchivePharmacy,
  useAssignPlan,
  usePlans,
} from "@modules/admin/hooks/useAdmin";
import { AdminNav } from "@modules/admin/components/AdminNav";
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
  Select,
  ConfirmDialog,
  Skeleton,
} from "@shared/ui";

export default function PharmacyDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string;

  const { data: org, isLoading } = useAdminOrganization(id);
  const { data: sessions } = useOrgSessions(id);
  const revoke = useRevokeOrgSessions(id);
  const { data: plans } = usePlans(false);
  const setSuspended = useSetSuspended();
  const archive = useArchivePharmacy();
  const assignPlan = useAssignPlan(id);

  const [planCode, setPlanCode] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "suspend" | "archive" | null
  >(null);

  const planOptions = (plans ?? []).map((p) => ({
    value: p.code,
    label: p.name,
  }));

  return (
    <Screen
      back="Back to pharmacies"
      overline="Pharmacy"
      title={org?.name || "Pharmacy"}
    >
      <AdminNav active="pharmacies" />

      {!org ? (
        isLoading ? (
          <VStack gap={16}>
            <Card>
              <VStack gap={14}>
                <HStack gap={10} align="center">
                  <Skeleton width={40} height={40} rounded="md" />
                  <VStack gap={6} flex={1}>
                    <Skeleton width="55%" height={18} />
                    <Skeleton width="70%" height={12} />
                  </VStack>
                </HStack>
                <Skeleton width="40%" height={14} />
                <Skeleton width="80%" height={12} />
              </VStack>
            </Card>
            <HStack gap={12} wrap>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.tile}>
                  <Skeleton height={72} />
                </View>
              ))}
            </HStack>
          </VStack>
        ) : (
          <Text variant="body-sm" tone="tertiary">
            Pharmacy not found.
          </Text>
        )
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
                </VStack>
              ) : null}

              {org.gstin || org.phone || org.drugLicenseNo ? (
                <VStack gap={4}>
                  <Text variant="label" tone="tertiary">
                    Business details
                  </Text>
                  {org.phone ? (
                    <HStack gap={6} align="center">
                      <Phone
                        size={14}
                        color={palette.text.tertiary}
                        strokeWidth={1.8}
                      />
                      <Text variant="body-sm" tone="secondary">
                        {org.phone}
                      </Text>
                    </HStack>
                  ) : null}
                  {org.gstin ? (
                    <Text variant="body-sm" tone="secondary">
                      GSTIN: {org.gstin}
                    </Text>
                  ) : null}
                  {org.drugLicenseNo ? (
                    <Text variant="body-sm" tone="secondary">
                      Drug licence: {org.drugLicenseNo}
                    </Text>
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

          {/* Signed-in devices.
              Kept separate from Suspend and Reset password: those already sign
              people out, but as a side effect of a much heavier action. A
              pharmacy admin locked out on their device limit needs a seat
              freed, not their password changed or their shop suspended. */}
          <Card>
            <VStack gap={12}>
              <HStack gap={8} align="center">
                <MonitorSmartphone
                  size={18}
                  color={palette.text.accent}
                  strokeWidth={2}
                />
                <Text variant="h4" tone="primary">
                  Signed-in devices
                </Text>
              </HStack>

              <Text variant="body-sm" tone="secondary">
                {sessions
                  ? `${sessions.totalSessions} device${sessions.totalSessions === 1 ? "" : "s"} signed in · limit ${sessions.deviceLimit} per user (${
                      sessions.deviceLimitSource === "pharmacy"
                        ? "set for this pharmacy"
                        : sessions.deviceLimitSource === "plan"
                          ? "from its plan"
                          : "platform default"
                    })`
                  : "Loading…"}
              </Text>

              {/* Lowering a limit doesn't evict anyone already signed in — the
                  count is only checked when a NEW session is created. */}
              {sessions?.overLimit?.length ? (
                <Text variant="caption" tone="warning">
                  Over the current limit:{" "}
                  {sessions.overLimit
                    .map((o) => `${o.name} (${o.count})`)
                    .join(", ")}
                  . Existing devices stay signed in until you sign them out.
                </Text>
              ) : null}

              {revoke.isSuccess ? (
                <Text variant="caption" tone="success">
                  {revoke.data?.message}
                </Text>
              ) : null}

              {(sessions?.sessions || []).map((s) => (
                <HStack key={s.id} gap={10} align="center">
                  <VStack gap={2} flex={1}>
                    <Text variant="label" tone="primary" numberOfLines={1}>
                      {s.userName}{" "}
                      <Text variant="caption" tone="tertiary">
                        {s.userEmail}
                      </Text>
                    </Text>
                    <Text variant="caption" tone="tertiary" numberOfLines={1}>
                      {[
                        s.deviceName,
                        s.ip,
                        new Date(s.lastSeenAt).toLocaleString(),
                      ]
                        .filter(Boolean)
                        .join("  ·  ")}
                    </Text>
                  </VStack>
                  <Button
                    label="Sign out"
                    size="sm"
                    variant="secondary"
                    fullWidth={false}
                    disabled={revoke.isPending}
                    onPress={() => revoke.mutate({ sessionId: s.id })}
                  />
                </HStack>
              ))}

              {sessions && sessions.totalSessions === 0 ? (
                <Text variant="body-sm" tone="tertiary">
                  Nobody is signed in right now.
                </Text>
              ) : null}

              {sessions && sessions.totalSessions > 0 ? (
                <Button
                  label="Sign out all devices"
                  size="sm"
                  variant="destructive"
                  loading={revoke.isPending}
                  onPress={() => revoke.mutate({})}
                />
              ) : null}
            </VStack>
          </Card>

          {/* Subscription */}
          <Card>
            <VStack gap={12}>
              <HStack gap={8} align="center">
                <CreditCard
                  size={18}
                  color={palette.text.accent}
                  strokeWidth={2}
                />
                <Text variant="h4" tone="primary">
                  Subscription
                </Text>
              </HStack>
              <Text variant="body-sm" tone="secondary">
                Current: {org.subscription?.planCode || "none"} ·{" "}
                {org.subscription?.status || "trial"}
              </Text>
              <Select
                label="Assign plan"
                placeholder="Choose a plan"
                value={planCode}
                options={planOptions}
                onChange={setPlanCode}
              />
              <Button
                label="Apply plan"
                size="sm"
                disabled={!planCode}
                loading={assignPlan.isPending}
                onPress={() =>
                  planCode && assignPlan.mutate({ planCode, status: "active" })
                }
              />
            </VStack>
          </Card>

          {(setSuspended.isError || archive.isError) && (
            <View style={styles.errorBox}>
              <Text variant="body-sm" tone="danger">
                {apiErrorMessage(setSuspended.error || archive.error)}
              </Text>
            </View>
          )}

          {/* Actions */}
          <VStack gap={10}>
            <HStack gap={10}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Edit"
                  variant="secondary"
                  icon={
                    <Pencil
                      size={16}
                      color={palette.text.secondary}
                      strokeWidth={2}
                    />
                  }
                  onPress={() =>
                    navigation.navigate("AdminEditPharmacy", { id })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Users"
                  variant="secondary"
                  icon={
                    <UsersRound
                      size={16}
                      color={palette.text.secondary}
                      strokeWidth={2}
                    />
                  }
                  onPress={() =>
                    navigation.navigate("AdminPharmacyUsers", { id })
                  }
                />
              </View>
            </HStack>

            {org.status === "active" ? (
              <Button
                label="Suspend pharmacy"
                variant="destructive"
                icon={<Ban size={16} color="#FFFFFF" strokeWidth={2} />}
                loading={setSuspended.isPending}
                onPress={() => setConfirmAction("suspend")}
              />
            ) : (
              <Button
                label="Reactivate pharmacy"
                icon={
                  <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2} />
                }
                loading={setSuspended.isPending}
                onPress={() => setSuspended.mutate({ id, suspend: false })}
              />
            )}

            <Button
              label="Archive pharmacy"
              variant="destructive"
              icon={<Trash2 size={16} color="#FFFFFF" strokeWidth={2} />}
              loading={archive.isPending}
              onPress={() => setConfirmAction("archive")}
            />
          </VStack>
        </VStack>
      )}

      <ConfirmDialog
        visible={confirmAction !== null}
        title={
          confirmAction === "archive"
            ? "Archive this pharmacy?"
            : "Suspend this pharmacy?"
        }
        message={
          confirmAction === "archive"
            ? "It will be hidden and everyone signed out. This is a soft-delete."
            : "All its users will be signed out and unable to log in until reactivated."
        }
        confirmLabel={confirmAction === "archive" ? "Archive" : "Suspend"}
        destructive
        loading={
          confirmAction === "archive"
            ? archive.isPending
            : setSuspended.isPending
        }
        onConfirm={() => {
          if (confirmAction === "suspend")
            setSuspended.mutate(
              { id, suspend: true },
              { onSuccess: () => setConfirmAction(null) },
            );
          else if (confirmAction === "archive")
            archive.mutate(id, { onSuccess: () => navigation.goBack() });
        }}
        onCancel={() => setConfirmAction(null)}
      />
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
