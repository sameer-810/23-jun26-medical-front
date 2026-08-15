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
  // WORKSPACE_REJECTED reads the same way to the applicant — neither is a
  // credential problem, and both are resolved by talking to us, not retrying.
  const errCode = apiErrorCode(mut.error);
  const isPending =
    errCode === "WORKSPACE_PENDING_APPROVAL" ||
    errCode === "WORKSPACE_REJECTED";
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

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Plusveda workspace"
    >
      <VStack gap={16}>
        {/*
          A registration still in the queue is not a failed sign-in.
          
          It renders as a calm amber notice rather than a red error, because
          the person did nothing wrong and there is nothing for them to retry —
          telling them "invalid credentials" in red would send them round the
          password-reset loop for an account that is simply not open yet.
        */}
        {mut.isError && isPending ? (
          <View style={pendingBox}>
            <VStack gap={4}>
              <Text variant="label" tone="primary">
                Your registration is under review
              </Text>
              <Text variant="body-sm" tone="secondary">
                {apiErrorMessage(
                  mut.error,
                  "You'll receive an email once your workspace is approved.",
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
