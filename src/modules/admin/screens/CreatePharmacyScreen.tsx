import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, User, Mail, Phone, Lock } from "lucide-react-native";
import { useCreatePharmacy } from "@modules/admin/hooks/useAdmin";
import { apiErrorMessage } from "@shared/api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius } from "@shared/designSystem";
import { Screen, Text, VStack, Card, Button } from "@shared/ui";
import { createPharmacySchema } from "@modules/admin/admin.validation";

export default function CreatePharmacyScreen() {
  const navigation = useNavigation<any>();
  const createMut = useCreatePharmacy();
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm({
    resolver: zodResolver(createPharmacySchema),
    mode: "onTouched",
    defaultValues: {
      organizationName: "",
      gstin: "",
      drugLicenseNo: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
    },
  });

  const submit = handleSubmit((f) => {
    setServerError(null);
    createMut.mutate(
      {
        organizationName: f.organizationName.trim(),
        gstin: f.gstin.trim().toUpperCase() || undefined,
        drugLicenseNo: f.drugLicenseNo.trim() || undefined,
        admin: {
          firstName: f.firstName.trim(),
          lastName: f.lastName.trim() || undefined,
          email: f.email.trim(),
          phone: f.phone.trim() || undefined,
          password: f.password,
        },
      },
      {
        onSuccess: () => navigation.goBack(),
        onError: (err) =>
          setServerError(apiErrorMessage(err, "Could not create pharmacy")),
      },
    );
  });

  return (
    <Screen back="Back to pharmacies" overline="Platform" title="Add pharmacy">
      {serverError ? (
        <View style={styles.errorBox}>
          <Text variant="body-sm" tone="danger">
            {serverError}
          </Text>
        </View>
      ) : null}

      <Card style={{ marginBottom: 16 }}>
        <VStack gap={16}>
          <Text variant="h4" tone="primary">
            Pharmacy
          </Text>
          <ControlledTextField
            control={control}
            name="organizationName"
            label="Pharmacy name"
            placeholder="e.g. City Medicals"
            leading={
              <Building2
                size={18}
                color={palette.text.tertiary}
                strokeWidth={1.8}
              />
            }
          />
          {/* Captured at creation rather than left for later: the GSTIN prints
              on every invoice and the drug licence is a legal requirement to
              trade, so a pharmacy created without them is non-compliant from
              its first sale. */}
          <ControlledTextField
            control={control}
            name="gstin"
            label="GSTIN (optional)"
            placeholder="27AAAAA0000A1Z5"
            autoCapitalize="characters"
            hint="15 characters — prints on every invoice"
          />
          <ControlledTextField
            control={control}
            name="drugLicenseNo"
            label="Drug licence no. (optional)"
            placeholder="e.g. MH-ALX-123456"
            autoCapitalize="characters"
          />
        </VStack>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <VStack gap={16}>
          <Text variant="h4" tone="primary">
            Owner (Admin)
          </Text>
          <Text variant="body-sm" tone="tertiary">
            This person gets the pharmacy admin login and can then add their own
            staff.
          </Text>
          <ControlledTextField
            control={control}
            name="firstName"
            label="First name"
            leading={
              <User size={18} color={palette.text.tertiary} strokeWidth={1.8} />
            }
          />
          <ControlledTextField
            control={control}
            name="lastName"
            label="Last name (optional)"
          />
          <ControlledTextField
            control={control}
            name="email"
            label="Email"
            placeholder="owner@pharmacy.com"
            keyboardType="email-address"
            autoCapitalize="none"
            leading={
              <Mail size={18} color={palette.text.tertiary} strokeWidth={1.8} />
            }
          />
          <ControlledTextField
            control={control}
            name="phone"
            label="Phone (optional)"
            keyboardType="phone-pad"
            leading={
              <Phone
                size={18}
                color={palette.text.tertiary}
                strokeWidth={1.8}
              />
            }
          />
          <ControlledTextField
            control={control}
            name="password"
            label="Temporary password"
            secureTextEntry
            autoCapitalize="none"
            placeholder="At least 8 characters"
            leading={
              <Lock size={18} color={palette.text.tertiary} strokeWidth={1.8} />
            }
          />
        </VStack>
      </Card>

      <Button
        label="Create pharmacy"
        size="lg"
        loading={createMut.isPending}
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
