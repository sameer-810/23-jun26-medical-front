import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useForm } from "react-hook-form";
import { ArrowLeft } from "lucide-react-native";
import {
  useAdminOrganization,
  useUpdatePharmacy,
} from "@modules/admin/hooks/useAdmin";
import { apiErrorMessage } from "@shared/api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius } from "@shared/designSystem";
import { Screen, Text, VStack, Card, Button } from "@shared/ui";

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
      });
  }, [org, reset]);

  const submit = handleSubmit((f) => {
    setServerError(null);
    update.mutate(f, {
      onSuccess: () => navigation.goBack(),
      onError: (err) => setServerError(apiErrorMessage(err)),
    });
  });

  return (
    <Screen
      overline="Pharmacy"
      title="Edit pharmacy"
      right={
        <Button
          label="Back"
          size="sm"
          variant="secondary"
          icon={
            <ArrowLeft
              size={16}
              color={palette.text.secondary}
              strokeWidth={2}
            />
          }
          onPress={() => navigation.goBack()}
        />
      }
    >
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
