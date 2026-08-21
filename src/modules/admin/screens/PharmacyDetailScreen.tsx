import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  Mail,
  Phone,
  Ban,
  CheckCircle2,
  Pencil,
  UsersRound,
  Trash2,
} from "lucide-react-native";
import {
  useAdminOrganization,
  useOrgSessions,
  useRevokeOrgSessions,
  useSetSuspended,
  useSetApproval,
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
  StatRow,
  Select,
  ConfirmDialog,
  PromptDialog,
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
  const setApproval = useSetApproval();
  const archive = useArchivePharmacy();
  const assignPlan = useAssignPlan(id);

  const [planCode, setPlanCode] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "suspend" | "archive" | null
  >(null);
  const [declineOpen, setDeclineOpen] = useState(false);

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
                <VStack gap={6}>
                  <Skeleton width="55%" height={18} />
                  <Skeleton width="70%" height={12} />
                </VStack>
                <Skeleton width="40%" height={14} />
                <Skeleton width="80%" height={12} />
              </VStack>
            </Card>
            {/* One block, because the stats now load as one panel. */}
            <Skeleton height={68} rounded="lg" />
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
                {/* The teal building well is gone: the page is already titled
                    with this pharmacy's name, so the bubble was decoration
                    competing with the status chip for the same glance. */}
                <HStack gap={10} align="center" style={{ flex: 1 }}>
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
                {/*
                  Approval outranks suspension in what an operator needs to
                  see. A workspace can be `isActive` and still be pending —
                  showing "Active" for somebody who cannot log in is the
                  single most misleading thing this page could say.
                */}
                {org.approvalStatus === "pending" ? (
                  <StatusChip label="Awaiting approval" tone="warning" />
                ) : org.approvalStatus === "rejected" ? (
                  <StatusChip label="Declined" tone="danger" />
                ) : (
                  <StatusChip
                    label={org.status === "active" ? "Active" : "Suspended"}
                    tone={org.status === "active" ? "success" : "danger"}
                  />
                )}
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

          {/* Size of the tenant, at a glance. Three neutral counts — nothing
              here is a fault state, so nothing here is coloured. */}
          <StatRow
            columns={3}
            stats={[
              {
                label: "Users",
                value: org.stats.users.toLocaleString("en-IN"),
              },
              {
                label: "Products",
                value: org.stats.products.toLocaleString("en-IN"),
              },
              {
                label: "Sales",
                value: org.stats.sales.toLocaleString("en-IN"),
              },
            ]}
          />

          {/* Signed-in devices.
              Kept separate from Suspend and Reset password: those already sign
              people out, but as a side effect of a much heavier action. A
              pharmacy admin locked out on their device limit needs a seat
              freed, not their password changed or their shop suspended. */}
          <Card>
            <VStack gap={12}>
              {/* Heading stands on its own — the teal glyph beside it was the
                  only accent colour in the card and it labelled nothing the
                  words did not already say. */}
              <Text variant="h4" tone="primary">
                Signed-in devices
              </Text>

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
              <Text variant="h4" tone="primary">
                Subscription
              </Text>
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

          {(setSuspended.isError || archive.isError || setApproval.isError) && (
            <View style={styles.errorBox}>
              <Text variant="body-sm" tone="danger">
                {apiErrorMessage(
                  setSuspended.error || archive.error || setApproval.error,
                )}
              </Text>
            </View>
          )}

          {/* Actions */}
          <VStack gap={10}>
            <HStack gap={10}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Edit"
                  size="sm"
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
                  size="sm"
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

            {/*
              The approval decision, shown only while one is outstanding.
              
              Placed above suspend/archive because for a pending pharmacy it is
              the ONLY action that matters — everything below it operates on an
              account nobody can log into yet.
            */}
            {org.approvalStatus === "pending" ? (
              <View style={pendingPanel}>
                <VStack gap={10}>
                  <VStack gap={2}>
                    <Text variant="label" tone="primary">
                      Waiting for your decision
                    </Text>
                    <Text variant="body-sm" tone="secondary">
                      Registered{" "}
                      {org.approvalRequestedAt
                        ? new Date(org.approvalRequestedAt).toLocaleDateString(
                            "en-IN",
                          )
                        : "recently"}
                      . They cannot sign in until this is approved.
                    </Text>
                  </VStack>
                  {org.contactPersonalEmail || org.contactPhone ? (
                    <Text variant="body-sm" tone="tertiary">
                      Contact: {org.contactPhone || "—"}
                      {org.contactPersonalEmail
                        ? ` · ${org.contactPersonalEmail}`
                        : ""}
                    </Text>
                  ) : null}
                  <HStack gap={8} wrap>
                    <Button
                      label="Approve & activate"
                      size="sm"
                      fullWidth={false}
                      icon={
                        <CheckCircle2
                          size={16}
                          color="#FFFFFF"
                          strokeWidth={2}
                        />
                      }
                      loading={setApproval.isPending}
                      onPress={() => setApproval.mutate({ id, approve: true })}
                    />
                    {/* Sits one tap from "Approve & activate" and cannot be
                        undone, so it confirms like Suspend and Archive do. */}
                    <Button
                      label="Decline"
                      size="sm"
                      variant="secondary"
                      fullWidth={false}
                      loading={setApproval.isPending}
                      onPress={() => setDeclineOpen(true)}
                    />
                  </HStack>
                </VStack>
              </View>
            ) : null}

            {org.status === "active" ? (
              <Button
                label="Suspend pharmacy"
                size="sm"
                variant="destructive"
                icon={<Ban size={16} color="#FFFFFF" strokeWidth={2} />}
                loading={setSuspended.isPending}
                onPress={() => setConfirmAction("suspend")}
              />
            ) : (
              <Button
                label="Reactivate pharmacy"
                size="sm"
                icon={
                  <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2} />
                }
                loading={setSuspended.isPending}
                onPress={() => setSuspended.mutate({ id, suspend: false })}
              />
            )}

            <Button
              label="Archive pharmacy"
              size="sm"
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

      {/* The note reaches the applicant, so it is asked for here rather than
          left as an API field nothing fills. */}
      <PromptDialog
        visible={declineOpen}
        title={`Decline ${org?.name || "this registration"}?`}
        message="They will not be able to sign in. Add a short reason if you want them to know why."
        label="Reason shown to the applicant (optional)"
        placeholder="e.g. Drug licence number could not be verified"
        confirmLabel="Decline registration"
        loading={setApproval.isPending}
        onSubmit={(note) =>
          setApproval.mutate(
            { id, approve: false, note: note.trim() || undefined },
            { onSuccess: () => setDeclineOpen(false) },
          )
        }
        onCancel={() => setDeclineOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.danger.bg,
    borderWidth: 1,
    borderColor: palette.danger.border,
  },
});

const pendingPanel = {
  backgroundColor: palette.warning.bg,
  borderColor: palette.warning.border,
  borderWidth: 1,
  borderRadius: radius.md,
  padding: 14,
} as const;
