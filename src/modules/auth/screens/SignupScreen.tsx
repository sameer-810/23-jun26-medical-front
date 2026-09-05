import React, { useEffect, useState } from "react";
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

type Nav = {
  navigate: (s: string, params?: object) => void;
  /**
   * Replace, not push, on the way to the pricing page: the form is submitted
   * and the workspace exists, so Back must not return to a filled-in form
   * whose only button would try to register the same shop twice.
   */
  replace: (s: string, params?: object) => void;
};
type Route = { params?: { plan?: string } };

const INDUSTRIES = [
  { key: "pharmacy", label: "Pharmacy" },
  { key: "medical", label: "Medical Store" },
  { key: "hospital", label: "Hospital" },
  { key: "fmcg", label: "FMCG" },
  { key: "grocery", label: "Grocery" },
  { key: "spare_parts", label: "Spare Parts" },
  { key: "other", label: "Other" },
];

export default function SignupScreen({
  navigation,
  route,
}: {
  navigation: Nav;
  route?: Route;
}) {
  const [industry, setIndustry] = useState("pharmacy");
  const [show, setShow] = useState(false);
  const mut = useSignup();

  /**
   * Which price card they clicked to get here — `?plan=12m`, set by every
   * button on the public price list.
   *
   * It is carried, not enforced: an unknown or missing code changes nothing
   * about the registration. These links arrive forwarded on WhatsApp weeks
   * after they were sent, and a stale one must not be able to fail a signup.
   */
  const requestedPlan = route?.params?.plan?.trim() || undefined;
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
      planCode: requestedPlan,
    }),
  );

  /**
   * Registered — on to the plans.
   *
   * The workspace exists and is queued for approval; the client asked for the
   * full price list to be what a new registration lands on, so the "awaiting
   * approval" message moved there rather than being said twice. The Pricing
   * screen still leads with it: it has to be unmistakably a GOOD outcome (the
   * form worked) while being equally clear that there is nothing to log into
   * yet, because the next thing this person tries is signing in.
   */
  useEffect(() => {
    if (!mut.isSuccess) return;
    navigation.replace("Pricing", { plan: requestedPlan, pending: true });
  }, [mut.isSuccess, navigation, requestedPlan]);

  /* One frame, at most — but never a blank screen, and never the form again
     with no sign that it worked, if the redirect is somehow blocked. */
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
                  Taking you to the plans…
                </Text>
              </VStack>
            </HStack>
          </View>

          <Button
            label="See the plans"
            onPress={() =>
              navigation.navigate("Pricing", {
                plan: requestedPlan,
                pending: true,
              })
            }
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
