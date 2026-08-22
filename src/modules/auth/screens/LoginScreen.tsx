import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, Eye, EyeOff } from "lucide-react-native";
import { useLogin } from "@modules/auth/hooks/useAuth";
import { loginSchema } from "@modules/auth/auth.validation";
import { apiErrorMessage, apiErrorCode } from "@api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius } from "@shared/designSystem";
import { Text, VStack, HStack, Button } from "@shared/ui";
import { AuthLayout } from "@modules/auth/components/AuthLayout";

type Nav = { navigate: (s: string) => void };

export default function LoginScreen({ navigation }: { navigation: Nav }) {
  const [show, setShow] = useState(false);
  const mut = useLogin();
  // Pending and rejected are both workspace states, not credential errors, but
  // they need different copy: pending resolves by waiting, rejected does not.
  const errCode = apiErrorCode(mut.error);
  const isPending = errCode === "WORKSPACE_PENDING_APPROVAL";
  const isRejected = errCode === "WORKSPACE_REJECTED";
  const needsUs = isPending || isRejected;
  /**
   * The device cap is the one refusal the user can clear themselves, but only
   * from here — the profile it used to point at is behind this very login.
   */
  const atDeviceLimit = errCode === "DEVICE_LIMIT_REACHED";
  // onTouched: validate a field once it's blurred, then keep it live — the same
  // "don't scold mid-type" UX, now via the maintained standard library.
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit((data) =>
    mut.mutate({ email: data.email.trim(), password: data.password }),
  );
  // Re-submits the same credentials, releasing the other sessions first.
  const submitSigningOutOthers = handleSubmit((data) =>
    mut.mutate({
      email: data.email.trim(),
      password: data.password,
      signOutOthers: true,
    }),
  );

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Plusveda workspace"
    >
      <VStack gap={16}>
        {/* Workspace-state errors get the amber notice, not the red error panel. */}
        {mut.isError && atDeviceLimit ? (
          <View style={pendingBox}>
            <VStack gap={8}>
              <Text variant="label" tone="primary">
                Signed in on too many devices
              </Text>
              <Text variant="body-sm" tone="secondary">
                {apiErrorMessage(mut.error)}
              </Text>
              <Button
                label="Sign out everywhere and continue here"
                variant="secondary"
                size="sm"
                loading={mut.isPending}
                onPress={submitSigningOutOthers}
              />
            </VStack>
          </View>
        ) : mut.isError && needsUs ? (
          <View style={pendingBox}>
            <VStack gap={4}>
              <Text variant="label" tone="primary">
                {isRejected
                  ? "This registration was declined"
                  : "Your registration is under review"}
              </Text>
              <Text variant="body-sm" tone="secondary">
                {apiErrorMessage(
                  mut.error,
                  isRejected
                    ? "Get in touch and we'll go through what happened."
                    : "You'll receive an email once your workspace is approved.",
                )}
              </Text>
            </VStack>
          </View>
        ) : mut.isError ? (
          <View style={errorBox}>
            <Text variant="body-sm" tone="danger">
              {apiErrorMessage(mut.error, "Invalid email or password")}
            </Text>
          </View>
        ) : null}

        <ControlledTextField
          control={control}
          name="email"
          label="Email"
          leading={
            <Mail size={18} color={palette.text.tertiary} strokeWidth={1.8} />
          }
          placeholder="you@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          onSubmitEditing={submit}
        />
        <ControlledTextField
          control={control}
          name="password"
          label="Password"
          leading={
            <Lock size={18} color={palette.text.tertiary} strokeWidth={1.8} />
          }
          placeholder="••••••••"
          secureTextEntry={!show}
          onSubmitEditing={submit}
          trailing={
            <Pressable hitSlop={10} onPress={() => setShow((s) => !s)}>
              {show ? (
                <EyeOff
                  size={18}
                  color={palette.text.tertiary}
                  strokeWidth={1.8}
                />
              ) : (
                <Eye
                  size={18}
                  color={palette.text.tertiary}
                  strokeWidth={1.8}
                />
              )}
            </Pressable>
          }
        />
        <Pressable
          onPress={() => navigation.navigate("ForgotPassword")}
          hitSlop={6}
        >
          <Text variant="label" tone="link" align="right">
            Forgot password?
          </Text>
        </Pressable>

        <Button
          label="Sign in"
          onPress={submit}
          loading={mut.isPending}
          size="lg"
        />

        <HStack
          justify="center"
          align="center"
          gap={5}
          style={{ marginTop: 8 }}
        >
          <Text variant="body-sm" tone="tertiary">
            New to Plusveda?
          </Text>
          <Pressable onPress={() => navigation.navigate("Signup")} hitSlop={6}>
            <Text variant="label" tone="link">
              Create a workspace
            </Text>
          </Pressable>
        </HStack>
      </VStack>
    </AuthLayout>
  );
}

const errorBox = {
  padding: 14,
  borderRadius: radius.md,
  backgroundColor: palette.danger.bg,
  borderWidth: 1,
  borderColor: palette.danger.border,
} as const;

const pendingBox = {
  backgroundColor: palette.warning.bg,
  borderColor: palette.warning.border,
  borderWidth: 1,
  borderRadius: radius.md,
  padding: 14,
} as const;
