import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Phone,
  AtSign,
  Clock3,
} from "lucide-react-native";
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
      personalEmail: "",
      phone: "",
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
      personalEmail: d.personalEmail.trim(),
      phone: d.phone.trim(),
      password: d.password,
    }),
  );

  /**
   * Registered, and now waiting.
   *
   * This replaces the old behaviour of dropping straight into the dashboard.
   * It has to be unmistakably a GOOD outcome — the form worked — while being
   * equally clear that there is nothing to log into yet, because the next
   * thing this person will try is signing in, and a vague confirmation earns a
   * support call when that fails.
   */
  if (mut.isSuccess) {
    return (
      <AuthLayout
        title="Registration received"
        subtitle="We're reviewing your details and preparing your quotation"
      >
        <VStack gap={16}>
          <View style={pendingBox}>
            <HStack gap={10} align="flex-start">
              <Clock3
                size={18}
                color={palette.warning.text}
                strokeWidth={2}
                style={{ marginTop: 1 }}
              />
              <VStack gap={6} flex={1}>
                <Text variant="label" tone="primary">
                  Your workspace is awaiting approval
                </Text>
                <Text variant="body-sm" tone="secondary">
                  You won&apos;t be able to sign in until our team activates it.
                  We&apos;ll email you as soon as that&apos;s done — usually
                  within one working day.
                </Text>
              </VStack>
            </HStack>
          </View>

          <Text variant="body-sm" tone="tertiary">
            We&apos;ll contact you on the phone number and personal email you
            entered. Nothing else is needed from you right now.
          </Text>

          <Button
            label="Back to sign in"
            variant="secondary"
            onPress={() => navigation.navigate("Login")}
          />
        </VStack>
      </AuthLayout>
    );
  }

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
          hint="This is the address you'll sign in with"
        />

        {/*
          Personal email and phone are how sales reaches the owner about the
          quotation, before there is an account to log into. The email above is
          often the shop's shared address that three people read; these are the
          owner's own.
        */}
        <ControlledTextField
          control={control}
          name="personalEmail"
          label="Your personal email"
          leading={
            <AtSign size={18} color={palette.text.tertiary} strokeWidth={1.8} />
          }
          placeholder="owner@gmail.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <ControlledTextField
          control={control}
          name="phone"
          label="Contact number"
          leading={
            <Phone size={18} color={palette.text.tertiary} strokeWidth={1.8} />
          }
          placeholder="+91 98765 43210"
          keyboardType="phone-pad"
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

const pendingBox = {
  backgroundColor: palette.warning.bg,
  borderColor: palette.warning.border,
  borderWidth: 1,
  borderRadius: radius.md,
  padding: 14,
} as const;
