import React from "react";
import { View, Pressable } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react-native";
import { useForgotPassword } from "@modules/auth/hooks/useAuth";
import { forgotPasswordSchema } from "@modules/auth/auth.validation";
import { apiErrorMessage } from "@api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius } from "@shared/designSystem";
import { Text, VStack, HStack, Button } from "@shared/ui";
import { AuthLayout } from "@modules/auth/components/AuthLayout";

type Nav = { navigate: (s: string, p?: object) => void };

export default function ForgotPasswordScreen({
  navigation,
}: {
  navigation: Nav;
}) {
  const mut = useForgotPassword();
  const { control, handleSubmit, getValues } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  const submit = handleSubmit((d) => mut.mutate({ email: d.email.trim() }));

  return (
    <AuthLayout
      title="Reset password"
      subtitle="We'll email you a 6-digit reset code"
    >
      <VStack gap={16}>
        {mut.isSuccess ? (
          <View style={infoBox}>
            <Text variant="body-sm" tone="success">
              If that email exists, a reset code is on its way. Enter it on the
              next screen.
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
          name="email"
          label="Email"
          leading={
            <Mail size={18} color={palette.text.tertiary} strokeWidth={1.8} />
          }
          placeholder="you@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Button
          label="Send reset code"
          onPress={submit}
          loading={mut.isPending}
          size="lg"
        />

        {mut.isSuccess ? (
          <Button
            label="I have a code"
            variant="secondary"
            onPress={() =>
              navigation.navigate("ResetPassword", {
                email: getValues("email").trim(),
              })
            }
          />
        ) : null}

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
