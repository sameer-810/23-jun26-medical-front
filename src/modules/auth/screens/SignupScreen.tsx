import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Mail, Lock, User, Eye, EyeOff } from "lucide-react-native";
import { useSignup } from "@modules/auth/hooks/useAuth";
import { signupSchema } from "@modules/auth/auth.validation";
import { apiErrorMessage } from "@api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius } from "@shared/designSystem";
import { Text, VStack, HStack, Button, ChipsRow } from "@shared/ui";
import { AuthLayout } from "@modules/auth/components/AuthLayout";

type Nav = { navigate: (s: string) => void };

const INDUSTRIES = [
  { key: "pharmacy", label: "Pharmacy" },
  { key: "medical", label: "Medical Store" },
  { key: "hospital", label: "Hospital" },
  { key: "fmcg", label: "FMCG" },
  { key: "grocery", label: "Grocery" },
  { key: "spare_parts", label: "Spare Parts" },
  { key: "other", label: "Other" },
];

export default function SignupScreen({ navigation }: { navigation: Nav }) {
  const [industry, setIndustry] = useState("pharmacy");
  const [show, setShow] = useState(false);
  const mut = useSignup();
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(signupSchema),
    mode: "onTouched",
    defaultValues: {
      organizationName: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
  });

  const submit = handleSubmit((d) =>
    mut.mutate({
      organizationName: d.organizationName.trim(),
      industry,
      firstName: d.firstName.trim(),
      lastName: d.lastName.trim() || undefined,
      email: d.email.trim(),
      password: d.password,
    }),
  );

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="You'll be the Admin — invite your team after sign-up"
    >
      <VStack gap={16}>
        {mut.isError && (
          <View style={errorBox}>
            <Text variant="body-sm" tone="danger">
              {apiErrorMessage(mut.error, "Could not create workspace")}
            </Text>
          </View>
        )}

        <ControlledTextField
          control={control}
          name="organizationName"
          label="Company / Store name"
          leading={
            <Building2
              size={18}
              color={palette.text.tertiary}
              strokeWidth={1.8}
            />
          }
          placeholder="Acme Pharmacy"
        />

        <View>
          <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
            Industry
          </Text>
          <ChipsRow
            chips={INDUSTRIES}
            active={industry}
            onChange={setIndustry}
          />
        </View>

        <HStack gap={12}>
          <View style={{ flex: 1 }}>
            <ControlledTextField
              control={control}
              name="firstName"
              label="First name"
              leading={
                <User
                  size={18}
                  color={palette.text.tertiary}
                  strokeWidth={1.8}
                />
              }
              placeholder="Aisha"
            />
          </View>
          <View style={{ flex: 1 }}>
            <ControlledTextField
              control={control}
              name="lastName"
              label="Last name"
              placeholder="Khan"
            />
          </View>
        </HStack>

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
        <ControlledTextField
          control={control}
          name="password"
          label="Password"
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

        <Button
          label="Create workspace"
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
            Already have an account?
          </Text>
          <Pressable onPress={() => navigation.navigate("Login")} hitSlop={6}>
            <Text variant="label" tone="link">
              Sign in
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
