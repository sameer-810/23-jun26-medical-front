import React, { useState } from "react";
import { View, Switch } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, KeyRound, Trash2, Pencil } from "lucide-react-native";
import {
  useTeamUser,
  usePermissionCatalogue,
  useUpdateMember,
  useUpdatePermissions,
  useSetActive,
  useResetUserPassword,
  useRemoveUser,
} from "@modules/team/hooks/useTeam";
import { editMemberSchema } from "@modules/team/team.validation";
import { apiErrorMessage } from "@api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { normalizePhone } from "@shared/form/fields";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Avatar,
  Button,
  TextField,
  ChipsRow,
  StatusChip,
  ConfirmDialog,
  Skeleton,
} from "@shared/ui";
import { PermissionEditor } from "@modules/team/components/PermissionEditor";

export default function UserDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string;

  const { data: user } = useTeamUser(id);
  const { data: catalogue } = usePermissionCatalogue();
  const updateMut = useUpdatePermissions(id);
  const memberMut = useUpdateMember(id);
  const activeMut = useSetActive(id);
  const resetMut = useResetUserPassword(id);
  const removeMut = useRemoveUser();

  const [roleLabel, setRoleLabel] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  /** Unsaved permission / role-label edits. */
  const [dirty, setDirty] = useState(false);

  const detailsForm = useForm({
    resolver: zodResolver(editMemberSchema),
    mode: "onTouched",
    defaultValues: { firstName: "", lastName: "", email: "", phone: "" },
  });

  // Sync the editable fields from the loaded user — adjusted during render when
  // the user reference changes (React's "reset state on prop change" pattern),
  // not in an effect.
  const [syncedUser, setSyncedUser] = useState(user);
  if (user !== syncedUser) {
    setSyncedUser(user);
    // Any refetch lands here — including the one the Active switch triggers —
    // so unsaved permission edits must win over the server copy.
    if (user && !dirty) {
      setRoleLabel(user.roleLabel || "");
      setPermissions(user.permissions || []);
    }
  }

  if (!user) {
    return (
      <Screen back="Back to team" overline="Team" title="Member">
        <VStack gap={12}>
          <Card>
            <HStack gap={14} align="center">
              <Skeleton width={54} height={54} rounded="full" />
              <VStack gap={8} flex={1}>
                <Skeleton width="50%" height={18} />
                <Skeleton width="70%" height={14} />
              </VStack>
            </HStack>
          </Card>
          <Card>
            <VStack gap={10}>
              <Skeleton width="30%" height={16} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </VStack>
          </Card>
        </VStack>
      </Screen>
    );
  }

  const isAdmin = user.role === "admin";
  const labelChips = (catalogue?.suggestedLabels || []).map((l) => ({
    key: l,
    label: l,
  }));
  const toggle = (key: string) => {
    setDirty(true);
    setPermissions((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
    );
  };
  const pickLabel = (l: string) => {
    setDirty(true);
    setRoleLabel(l);
  };

  const openDetails = () => {
    detailsForm.reset({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
    });
    setEditingDetails(true);
  };

  const saveDetails = detailsForm.handleSubmit((f) =>
    memberMut.mutate(
      {
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        email: f.email.trim(),
        // Omitted when empty: the server's `phone` rule has no empty-string
        // escape, so "" is rejected rather than clearing the number.
        ...(f.phone.trim() ? { phone: normalizePhone(f.phone) } : {}),
      },
      { onSuccess: () => setEditingDetails(false) },
    ),
  );

  return (
    <Screen
      back="Back to team"
      overline="Team member"
      title={user.fullName}
      subtitle={user.email}
    >
      <Card style={{ marginBottom: 16 }}>
        <HStack gap={14} align="center">
          <Avatar
            name={user.fullName}
            size={40}
            tone={isAdmin ? "cobalt" : "teal"}
          />
          <VStack gap={4} flex={1}>
            <HStack gap={8} align="center">
              <Text variant="h3" tone="primary">
                {user.fullName}
              </Text>
              {isAdmin && (
                <ShieldCheck
                  size={16}
                  color={palette.cobalt[600]}
                  strokeWidth={2}
                />
              )}
            </HStack>
            <HStack gap={6} wrap>
              <StatusChip
                label={isAdmin ? "Admin" : user.roleLabel || "Staff"}
                tone={isAdmin ? "info" : "neutral"}
              />
              <StatusChip
                label={user.isActive ? "Active" : "Disabled"}
                tone={user.isActive ? "success" : "danger"}
              />
            </HStack>
            <Text variant="caption" tone="tertiary">
              {[user.email, user.phone].filter(Boolean).join(" · ")}
            </Text>
          </VStack>
          {/* Contact details are not privileges, so this is offered for the
              Admin too — the panel below only bars permission changes. */}
          <Button
            label="Edit details"
            variant="secondary"
            size="sm"
            fullWidth={false}
            icon={
              <Pencil size={15} color={palette.text.primary} strokeWidth={2} />
            }
            onPress={openDetails}
          />
        </HStack>
      </Card>

      {editingDetails ? (
        <Card style={{ marginBottom: 16 }}>
          <VStack gap={12}>
            {memberMut.isError && (
              <Text variant="body-sm" tone="danger">
                {apiErrorMessage(memberMut.error)}
              </Text>
            )}
            <HStack gap={12}>
              <View style={{ flex: 1 }}>
                <ControlledTextField
                  control={detailsForm.control}
                  name="firstName"
                  label="First name"
                />
              </View>
              <View style={{ flex: 1 }}>
                <ControlledTextField
                  control={detailsForm.control}
                  name="lastName"
                  label="Last name"
                />
              </View>
            </HStack>
            <ControlledTextField
              control={detailsForm.control}
              name="email"
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <ControlledTextField
              control={detailsForm.control}
              name="phone"
              label="Phone"
              keyboardType="phone-pad"
            />
            <HStack gap={8} justify="flex-end">
              <Button
                label="Cancel"
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={() => setEditingDetails(false)}
              />
              <Button
                label="Save details"
                size="sm"
                fullWidth={false}
                loading={memberMut.isPending}
                onPress={saveDetails}
              />
            </HStack>
          </VStack>
        </Card>
      ) : null}

      {isAdmin ? (
        <Card>
          <VStack gap={8} align="center">
            <ShieldCheck
              size={28}
              color={palette.cobalt[600]}
              strokeWidth={1.8}
            />
            <Text variant="label-lg" tone="primary" align="center">
              This is the workspace Admin
            </Text>
            <Text variant="body-sm" tone="tertiary" align="center">
              The Admin always holds every permission and cannot be disabled or
              removed. Contact details can still be corrected above.
            </Text>
          </VStack>
        </Card>
      ) : (
        <>
          {updateMut.isError && (
            <View style={errorBox}>
              <Text variant="body-sm" tone="danger">
                {apiErrorMessage(updateMut.error)}
              </Text>
            </View>
          )}

          {/* Active toggle */}
          <Card style={{ marginBottom: 16 }}>
            <HStack align="center" justify="space-between">
              <VStack gap={2} flex={1}>
                <Text variant="label-lg" tone="primary">
                  Account active
                </Text>
                <Text variant="body-sm" tone="tertiary">
                  Disabled members cannot sign in.
                </Text>
                {/* A refused toggle silently snaps back without this. */}
                {activeMut.isError && (
                  <Text variant="caption" tone="danger">
                    {apiErrorMessage(activeMut.error)}
                  </Text>
                )}
              </VStack>
              <Switch
                value={user.isActive}
                onValueChange={(v) => activeMut.mutate(v)}
                trackColor={{
                  true: palette.teal[500],
                  false: palette.ink[200],
                }}
                thumbColor="#FFFFFF"
              />
            </HStack>
          </Card>

          {/* Role label */}
          <Card style={{ marginBottom: 16 }}>
            <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
              Role label
            </Text>
            <ChipsRow
              chips={labelChips}
              active={roleLabel}
              onChange={pickLabel}
            />
          </Card>

          {/* Permissions */}
          <Text variant="h3" tone="primary" style={{ marginBottom: 12 }}>
            Permissions
          </Text>
          <Card style={{ marginBottom: 16 }}>
            <PermissionEditor
              available={catalogue?.permissions || []}
              selected={permissions}
              onToggle={toggle}
            />
          </Card>

          {dirty && (
            <Text variant="caption" tone="warning" style={{ marginBottom: 8 }}>
              Unsaved permission changes.
            </Text>
          )}
          <Button
            label="Save changes"
            size="lg"
            loading={updateMut.isPending}
            onPress={() =>
              updateMut.mutate(
                { roleLabel, permissions },
                { onSuccess: () => setDirty(false) },
              )
            }
            style={{ marginBottom: 24 }}
          />

          {/* Admin reset password */}
          <Text variant="h3" tone="primary" style={{ marginBottom: 12 }}>
            Security
          </Text>
          <Card style={{ marginBottom: 16 }}>
            <VStack gap={12}>
              <TextField
                label="Reset password"
                leading={
                  <KeyRound
                    size={18}
                    color={palette.text.tertiary}
                    strokeWidth={1.8}
                  />
                }
                placeholder="New temporary password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              {resetMut.isSuccess && (
                <Text variant="caption" tone="success">
                  Password reset. Share the new password with the member.
                </Text>
              )}
              {resetMut.isError && (
                <Text variant="caption" tone="danger">
                  {apiErrorMessage(resetMut.error)}
                </Text>
              )}
              <Button
                label="Reset password"
                variant="secondary"
                disabled={newPassword.length < 6}
                loading={resetMut.isPending}
                onPress={() =>
                  resetMut.mutate(newPassword, {
                    onSuccess: () => setNewPassword(""),
                  })
                }
              />
            </VStack>
          </Card>

          {/* Remove */}
          <Card>
            <HStack align="center" justify="space-between">
              <VStack gap={2} flex={1}>
                <Text variant="label-lg" tone="primary">
                  Remove member
                </Text>
                <Text variant="body-sm" tone="tertiary">
                  Deactivates the account; history is preserved.
                </Text>
              </VStack>
              <Button
                label="Remove"
                variant="destructive"
                fullWidth={false}
                icon={<Trash2 size={16} color="#FFFFFF" strokeWidth={2} />}
                loading={removeMut.isPending}
                onPress={() => setConfirmOpen(true)}
              />
            </HStack>
          </Card>
        </>
      )}

      <ConfirmDialog
        visible={confirmOpen}
        title={`Remove ${user.fullName}?`}
        confirmLabel="Remove"
        destructive
        loading={removeMut.isPending}
        onConfirm={() =>
          removeMut.mutate(id, {
            onSuccess: () => navigation.goBack(),
          })
        }
        onCancel={() => setConfirmOpen(false)}
      />
    </Screen>
  );
}

const errorBox = {
  padding: 14,
  borderRadius: radius.md,
  backgroundColor: palette.danger.bg,
  borderWidth: 1,
  borderColor: palette.danger.border,
  marginBottom: 16,
} as const;
