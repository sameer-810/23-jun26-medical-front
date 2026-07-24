import React from "react";
import { View } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Phone, Lock, LogOut, Building2 } from "lucide-react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import {
  useUpdateProfile,
  useChangePassword,
} from "@modules/profile/hooks/useProfile";
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
} from "@shared/ui";

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const organization = useAuthStore((s) => s.organization);
  const logout = useAuthStore((s) => s.logout);
  const profileMut = useUpdateProfile();
  const pwdMut = useChangePassword();

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
            size={60}
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

      <Button
        label="Sign out"
        variant="destructive"
        icon={<LogOut size={18} color="#FFFFFF" strokeWidth={2} />}
        onPress={() => logout()}
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
