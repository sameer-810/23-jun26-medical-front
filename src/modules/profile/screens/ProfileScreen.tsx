import React, { useState } from "react";
import { View } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User,
  Phone,
  Lock,
  LogOut,
  Building2,
  Monitor,
  Trash2,
} from "lucide-react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import {
  useUpdateProfile,
  useChangePassword,
  useDeleteAccount,
} from "@modules/profile/hooks/useProfile";
import { useSessions, useLogoutAll } from "@modules/profile/hooks/useSessions";
import {
  profileDetailsSchema,
  changePasswordSchema,
} from "@modules/profile/profile.validation";
import { apiErrorMessage } from "@api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Avatar,
  Button,
  StatusChip,
  ErrorState,
  TextField,
  ConfirmDialog,
} from "@shared/ui";
import { fmtDateTime } from "@shared/format";

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const organization = useAuthStore((s) => s.organization);
  const logout = useAuthStore((s) => s.logout);
  const profileMut = useUpdateProfile();
  const pwdMut = useChangePassword();
  const {
    data: sessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
    error: sessionsErr,
    refetch: refetchSessions,
    isFetching: sessionsFetching,
  } = useSessions();
  const logoutAll = useLogoutAll();
  const deleteMut = useDeleteAccount();
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isAdmin = user?.role === "admin";

  // Two independent forms on one screen — profile details and a password change.
  const detailsForm = useForm({
    resolver: zodResolver(profileDetailsSchema),
    mode: "onTouched",
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
    },
  });
  const passwordForm = useForm({
    resolver: zodResolver(changePasswordSchema),
    mode: "onTouched",
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  const saveProfile = detailsForm.handleSubmit((f) =>
    profileMut.mutate({
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      // Omitted when empty rather than sent as "": the server's `phone` rule
      // (user.validation.js) has no empty-string escape, so "" is rejected and
      // a cleared number cannot be saved until it gains one.
      phone: f.phone.trim() || undefined,
    }),
  );
  const changePassword = passwordForm.handleSubmit((f) =>
    pwdMut.mutate(f, { onSuccess: () => passwordForm.reset() }),
  );

  return (
    <Screen
      overline="Account"
      title="Profile"
      subtitle="Manage your details and security"
    >
      <Card style={{ marginBottom: 24 }}>
        <HStack gap={16} align="center">
          <Avatar
            name={user?.fullName || "U"}
            size={48}
            tone={user?.role === "admin" ? "cobalt" : "teal"}
          />
          <VStack gap={4} flex={1}>
            <Text variant="h2" tone="primary">
              {user?.fullName}
            </Text>
            <Text variant="body-sm" tone="tertiary">
              {user?.email}
            </Text>
            <HStack gap={6} wrap>
              <StatusChip
                label={
                  user?.role === "admin" ? "Admin" : user?.roleLabel || "Staff"
                }
                tone={user?.role === "admin" ? "info" : "neutral"}
              />
            </HStack>
          </VStack>
        </HStack>
      </Card>

      {/* Organization */}
      <Card style={{ marginBottom: 24 }}>
        <HStack gap={12} align="center">
          <View style={iconWrap}>
            <Building2 size={18} color={palette.teal[600]} strokeWidth={2} />
          </View>
          <VStack gap={2} flex={1}>
            <Text variant="label-lg" tone="primary">
              {organization?.name}
            </Text>
            <Text variant="caption" tone="tertiary">
              Workspace · {organization?.industry}
            </Text>
          </VStack>
        </HStack>
      </Card>

      {/* Edit profile */}
      <Text variant="h3" tone="primary" style={{ marginBottom: 12 }}>
        Your details
      </Text>
      <Card style={{ marginBottom: 24 }}>
        <VStack gap={16}>
          {/* Status line sits above the fields, matching the password card below. */}
          {profileMut.isError && (
            <Text variant="caption" tone="danger">
              {apiErrorMessage(profileMut.error)}
            </Text>
          )}
          {profileMut.isSuccess && (
            <Text variant="caption" tone="success">
              Profile updated.
            </Text>
          )}
          <HStack gap={12}>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={detailsForm.control}
                name="firstName"
                label="First name"
                leading={
                  <User
                    size={18}
                    color={palette.text.tertiary}
                    strokeWidth={1.8}
                  />
                }
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
            name="phone"
            label="Phone"
            leading={
              <Phone
                size={18}
                color={palette.text.tertiary}
                strokeWidth={1.8}
              />
            }
            keyboardType="phone-pad"
          />
          <Button
            label="Save profile"
            variant="secondary"
            loading={profileMut.isPending}
            onPress={saveProfile}
          />
        </VStack>
      </Card>

      {/* Change password */}
      <Text variant="h3" tone="primary" style={{ marginBottom: 12 }}>
        Change password
      </Text>
      <Card style={{ marginBottom: 24 }}>
        <VStack gap={16}>
          {pwdMut.isError && (
            <Text variant="caption" tone="danger">
              {apiErrorMessage(pwdMut.error)}
            </Text>
          )}
          {pwdMut.isSuccess && (
            <Text variant="caption" tone="success">
              Password changed.
            </Text>
          )}
          <ControlledTextField
            control={passwordForm.control}
            name="currentPassword"
            label="Current password"
            leading={
              <Lock size={18} color={palette.text.tertiary} strokeWidth={1.8} />
            }
            secureTextEntry
          />
          <ControlledTextField
            control={passwordForm.control}
            name="newPassword"
            label="New password"
            leading={
              <Lock size={18} color={palette.text.tertiary} strokeWidth={1.8} />
            }
            secureTextEntry
          />
          <Button
            label="Update password"
            variant="secondary"
            loading={pwdMut.isPending}
            onPress={changePassword}
          />
        </VStack>
      </Card>

      {/* Signed-in devices */}
      <Text variant="h3" tone="primary" style={{ marginBottom: 4 }}>
        Signed-in devices
      </Text>
      {/* "Loading" must not stand in for a failure: the device cap is what
          locks people out, so the count has to be right or absent. */}
      <Text variant="body-sm" tone="tertiary" style={{ marginBottom: 12 }}>
        {sessions
          ? `Using ${sessions.used} of ${sessions.limit} allowed device${sessions.limit === 1 ? "" : "s"}.`
          : sessionsError
            ? "Your signed-in devices couldn't be loaded."
            : sessionsLoading
              ? "Loading your devices…"
              : ""}
      </Text>
      <Card style={{ marginBottom: 24 }}>
        <VStack gap={14}>
          {sessionsError && (
            <ErrorState
              error={sessionsErr}
              title="Couldn't load your devices"
              onRetry={() => refetchSessions()}
              retrying={sessionsFetching}
            />
          )}
          {logoutAll.isError && (
            <Text variant="caption" tone="danger">
              {apiErrorMessage(logoutAll.error)}
            </Text>
          )}
          {logoutAll.isSuccess && (
            <Text variant="caption" tone="success">
              {logoutAll.data?.message}
            </Text>
          )}

          {(sessions?.sessions || []).map((s) => (
            <HStack key={s.id} gap={12} align="center">
              <View style={iconWrap}>
                <Monitor
                  size={18}
                  color={palette.text.tertiary}
                  strokeWidth={1.8}
                />
              </View>
              <VStack gap={2} flex={1}>
                <HStack gap={8} align="center">
                  <Text variant="label" tone="primary" numberOfLines={1}>
                    {s.deviceName}
                  </Text>
                  {s.current && <StatusChip label="This device" tone="info" />}
                </HStack>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {[s.ip, fmtDateTime(s.lastSeenAt)]
                    .filter(Boolean)
                    .join("  ·  ")}
                </Text>
              </VStack>
            </HStack>
          ))}

          {/* Only meaningful when something else is holding a slot. */}
          {(sessions?.used ?? 0) > 1 && (
            <Button
              label="Sign out of other devices"
              variant="secondary"
              loading={logoutAll.isPending}
              onPress={() => logoutAll.mutate(true)}
            />
          )}
        </VStack>
      </Card>

      <Button
        label="Sign out"
        variant="destructive"
        icon={<LogOut size={18} color="#FFFFFF" strokeWidth={2} />}
        onPress={() => logout()}
      />

      {/* Delete account — App Store 5.1.1(v) and Google Play both require it
          in-app for any app that lets people sign up. DELETE /users/me. */}
      <Text
        variant="h3"
        tone="primary"
        style={{ marginTop: 32, marginBottom: 12 }}
      >
        Delete account
      </Text>
      <Card style={{ marginBottom: 24 }}>
        <VStack gap={16}>
          <Text variant="body-sm" tone="secondary">
            {isAdmin
              ? "You are this pharmacy's Admin, so deleting your account closes the whole workspace. Everyone on your team is signed out and can no longer sign in. Your personal details are erased immediately, and the pharmacy's records are deleted within 30 days, except invoices that GST law requires us to keep."
              : "Your sign-in is removed and your name, email and phone number are erased immediately. Sales and stock entries you made stay with the pharmacy, without your name."}
          </Text>
          {deleteMut.isError && (
            <Text variant="caption" tone="danger">
              {apiErrorMessage(
                deleteMut.error,
                "Could not delete your account",
              )}
            </Text>
          )}
          <TextField
            label="Enter your password to confirm"
            value={deletePassword}
            onChangeText={setDeletePassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
          />
          <Button
            label={
              isAdmin
                ? "Delete account and close workspace"
                : "Delete my account"
            }
            variant="destructive"
            icon={<Trash2 size={18} color="#FFFFFF" strokeWidth={2} />}
            disabled={deletePassword.length === 0}
            loading={deleteMut.isPending}
            onPress={() => setConfirmDelete(true)}
          />
        </VStack>
      </Card>
      <ConfirmDialog
        visible={confirmDelete}
        title={
          isAdmin ? "Close this pharmacy's workspace?" : "Delete your account?"
        }
        message="This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleteMut.isPending}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteMut.mutate(deletePassword);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

const iconWrap = {
  width: 40,
  height: 40,
  borderRadius: radius.md,
  backgroundColor: palette.teal[50],
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
