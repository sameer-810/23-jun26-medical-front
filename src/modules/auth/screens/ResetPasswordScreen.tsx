import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { KeyRound, Lock, Eye, EyeOff } from "lucide-react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useResetPassword } from "@modules/auth/hooks/useAuth";
import { resetPasswordSchema } from "@modules/auth/auth.validation";
import { apiErrorMessage } from "@api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius } from "@shared/designSystem";
import { Text, VStack, HStack, Button } from "@shared/ui";
import { AuthLayout } from "@modules/auth/components/AuthLayout";

type Nav = { navigate: (s: string) => void };
type Route = { params?: { email?: string } };

export default function ResetPasswordScreen({
  navigation,
  route,
}: {
  navigation: Nav;
  route: Route;
}) {
  const [show, setShow] = useState(false);
  const mut = useResetPassword();
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
    defaultValues: { token: "", password: "" },
  });

  const submit = handleSubmit((d) =>
    mut.mutate({ token: d.token.trim(), password: d.password }),
  );

  return (
    <AuthLayout
      title="Enter reset code"
      subtitle={
        route?.params?.email
          ? `Code sent to ${route.params.email}`
          : "Enter the code and a new password"
      }
    >
      <VStack gap={16}>
        {mut.isSuccess ? (
          <View style={infoBox}>
            <Text variant="body-sm" tone="success">
              Password reset. You can now sign in with your new password.
            </Text>
          </View>
        ) : null}
        {mut.isError && (
          <View style={errorBox}>
            <Text variant="body-sm" tone="danger">
              {apiErrorMessage(mut.error)}
            </Text>
          </View>
        )}

        <ControlledTextField
          control={control}
          name="token"
          label="Reset code"
          leading={
            <KeyRound
              size={18}
              color={palette.text.tertiary}
              strokeWidth={1.8}
            />
          }
          placeholder="6-digit code"
          keyboardType="number-pad"
        />
        <ControlledTextField
          control={control}
          name="password"
          label="New password"
          leading={
            <Lock size={18} color={palette.text.tertiary} strokeWidth={1.8} />
          }
          placeholder="At least 6 characters"
          secureTextEntry={!show}
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

        {mut.isSuccess ? (
          <Button
            label="Back to sign in"
            onPress={() => navigation.navigate("Login")}
            size="lg"
          />
        ) : (
          <Button
            label="Reset password"
            onPress={submit}
            loading={mut.isPending}
            size="lg"
          />
        )}

        <HStack justify="center" gap={5} style={{ marginTop: 8 }}>
          <Pressable onPress={() => navigation.navigate("Login")} hitSlop={6}>
            <Text variant="label" tone="link">
              Back to sign in
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
const infoBox = {
  padding: 14,
  borderRadius: radius.md,
  backgroundColor: palette.success.bg,
  borderWidth: 1,
  borderColor: palette.success.border,
} as const;
