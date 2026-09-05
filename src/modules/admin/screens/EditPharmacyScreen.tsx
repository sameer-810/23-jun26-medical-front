import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useForm } from "react-hook-form";
import {
  useAdminOrganization,
  useUpdatePharmacy,
} from "@modules/admin/hooks/useAdmin";
import { apiErrorMessage } from "@shared/api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius } from "@shared/designSystem";
import { Screen, Text, VStack, Card, Button } from "@shared/ui";
import type { UpdatePharmacyInput } from "@modules/admin/types";

export default function EditPharmacyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string;
  const { data: org } = useAdminOrganization(id);
  const update = useUpdatePharmacy(id);
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit, reset } = useForm({
    defaultValues: {
      name: "",
      industry: "pharmacy",
      email: "",
      phone: "",
      address: "",
      gstin: "",
      drugLicenseNo: "",
      maxDevicesPerUser: "",
      maxUsers: "",
      geminiApiKey: "",
      geminiModel: "",
    },
  });

  useEffect(() => {
    if (org)
      reset({
        name: org.name || "",
        industry: org.industry || "pharmacy",
        email: org.email || "",
        phone: org.phone || "",
        address: org.address || "",
        gstin: org.gstin || "",
        drugLicenseNo: org.drugLicenseNo || "",
        // Blank means "inherit" — showing 0 would read as "zero devices".
        maxDevicesPerUser: org.settings?.deviceLimitOverride
          ? String(org.settings.deviceLimitOverride)
          : "",
        maxUsers: org.settings?.userLimitOverride
          ? String(org.settings.userLimitOverride)
          : "",
        // Never pre-filled: we only ever hold a mask, and pushing the mask back
        // would save the literal "AIzaSy…7Xq2" as the key.
        geminiApiKey: "",
        geminiModel: org.settings?.geminiModel || "",
      });
  }, [org, reset]);

  const settings = org?.settings;

  const submit = handleSubmit((f) => {
    setServerError(null);
    const { maxDevicesPerUser, maxUsers, geminiApiKey, ...rest } = f;
    const body: UpdatePharmacyInput = {
      ...rest,
      // "" clears the override and hands the pharmacy back to its plan.
      maxDevicesPerUser: maxDevicesPerUser.trim()
        ? Number(maxDevicesPerUser)
        : 0,
      maxUsers: maxUsers.trim() ? Number(maxUsers) : 0,
    };
    // Only send the key when one was typed. Sending "" would DELETE the saved
    // key, so simply editing the phone number must not wipe it.
    if (geminiApiKey.trim()) body.geminiApiKey = geminiApiKey.trim();
    update.mutate(body, {
      onSuccess: () => navigation.goBack(),
      onError: (err) => setServerError(apiErrorMessage(err)),
    });
  });

  /** Explicit "use the platform key from now on". */
  const clearKey = () => {
    setServerError(null);
    update.mutate(
      { geminiApiKey: "" },
      { onError: (err) => setServerError(apiErrorMessage(err)) },
    );
  };

  return (
    <Screen back="Back to pharmacy" overline="Pharmacy" title="Edit pharmacy">
      {serverError ? (
        <View style={styles.errorBox}>
          <Text variant="body-sm" tone="danger">
            {serverError}
          </Text>
        </View>
      ) : null}

      <Card style={{ marginBottom: 16 }}>
        <VStack gap={16}>
          <ControlledTextField
            control={control}
            name="name"
            label="Pharmacy name"
          />
          <ControlledTextField
            control={control}
            name="phone"
            label="Phone"
            keyboardType="phone-pad"
          />
          <ControlledTextField
            control={control}
            name="email"
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <ControlledTextField
            control={control}
            name="address"
            label="Address"
          />
          <ControlledTextField
            control={control}
            name="gstin"
            label="GSTIN"
            autoCapitalize="characters"
          />
          <ControlledTextField
            control={control}
            name="drugLicenseNo"
            label="Drug licence no."
            autoCapitalize="characters"
          />
        </VStack>
      </Card>

      {/* ---- Per-pharmacy limits ---- */}
      <Card style={{ marginBottom: 16 }}>
        <VStack gap={14}>
          <VStack gap={2}>
            <Text variant="label-lg" tone="primary">
              Simultaneous devices
            </Text>
            <Text variant="caption" tone="tertiary">
              How many devices one staff account may stay signed in on at once.
              {settings
                ? `  Currently ${settings.deviceLimit} — from ${
                    settings.deviceLimitSource === "pharmacy"
                      ? "this pharmacy"
                      : settings.deviceLimitSource === "plan"
                        ? "its plan"
                        : "the platform default"
                  }.`
                : ""}
            </Text>
          </VStack>
          <ControlledTextField
            control={control}
            name="maxDevicesPerUser"
            label="Device limit for this pharmacy"
            keyboardType="number-pad"
            placeholder="Leave blank to use the plan / platform default"
          />
        </VStack>
      </Card>

      {/* ---- Staff accounts ----
          The limit was always ENFORCED — every path that creates a member goes
          through createUser, which refuses past the quota. What was missing was
          any way to SET it per pharmacy from here: the field did not exist, and
          the console's patch dropped maxUsers on the floor. */}
      <Card style={{ marginBottom: 16 }}>
        <VStack gap={14}>
          <VStack gap={2}>
            <Text variant="label-lg" tone="primary">
              Staff accounts
            </Text>
            <Text variant="caption" tone="tertiary">
              Maximum staff user accounts allowed for this pharmacy.
              {settings
                ? settings.userLimit
                  ? `  Currently ${settings.userLimit} — from ${
                      settings.userLimitSource === "pharmacy"
                        ? "this pharmacy"
                        : "its plan"
                    }.`
                  : "  Currently unlimited — no plan quota and no override."
                : ""}
            </Text>
          </VStack>
          <ControlledTextField
            control={control}
            name="maxUsers"
            label="User limit for this pharmacy"
            keyboardType="number-pad"
            placeholder="Leave blank to use the plan quota"
          />
        </VStack>
      </Card>

      {/* ---- Bill-scanning key ---- */}
      <Card style={{ marginBottom: 16 }}>
        <VStack gap={14}>
          <VStack gap={2}>
            <Text variant="label-lg" tone="primary">
              Bill scanning (Gemini)
            </Text>
            <Text variant="caption" tone="tertiary">
              {settings?.geminiConfigured
                ? `Using this pharmacy's own key (${settings.geminiKeyMasked}) — they pay Google directly and get their own quota.`
                : "Using the shared platform key. Add a key here to give this pharmacy its own quota."}
            </Text>
          </VStack>
          <ControlledTextField
            control={control}
            name="geminiApiKey"
            label={
              settings?.geminiConfigured ? "Replace API key" : "Gemini API key"
            }
            autoCapitalize="none"
            secureTextEntry
            placeholder={
              settings?.geminiConfigured
                ? "Leave blank to keep the saved key"
                : "AIza…"
            }
          />
          <ControlledTextField
            control={control}
            name="geminiModel"
            label="Model (optional)"
            autoCapitalize="none"
            placeholder="Leave blank for the platform default"
          />
          {settings?.geminiConfigured ? (
            <Button
              label="Remove key and use the platform key"
              variant="secondary"
              size="sm"
              loading={update.isPending}
              onPress={clearKey}
            />
          ) : null}
        </VStack>
      </Card>

      <Button
        label="Save changes"
        size="lg"
        loading={update.isPending}
        onPress={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.danger.bg,
    borderWidth: 1,
    borderColor: palette.danger.border,
    marginBottom: 16,
  },
});
