import React, { useEffect } from "react";
import { View, Switch } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Receipt, BellRing } from "lucide-react-native";
import {
  useSettings,
  useUpdateSettings,
} from "@modules/settings/hooks/useSettings";
import { settingsSchema } from "@modules/settings/settings.validation";
import { useAuthStore } from "@shared/store/useAuthStore";
import { apiErrorMessage } from "@api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
} from "@shared/ui";

/** A themed on/off row bound to a react-hook-form boolean field. */
function SwitchRow({ control, name }: { control: any; name: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Switch
          value={field.value}
          onValueChange={field.onChange}
          trackColor={{ true: palette.teal[500], false: palette.ink[200] }}
          thumbColor="#FFFFFF"
        />
      )}
    />
  );
}

export default function SettingsScreen() {
  const { data, isLoading, refetch, isRefetching } = useSettings();
  const mut = useUpdateSettings();
  const org = useAuthStore((s) => s.organization);

  const { control, handleSubmit, reset } = useForm({
    resolver: zodResolver(settingsSchema),
    mode: "onTouched",
    defaultValues: {
      legalName: "",
      addressLine1: "",
      city: "",
      state: "",
      pincode: "",
      phone: "",
      email: "",
      drugLicenseNo: "",
      gstin: "",
      taxEnabled: true,
      defaultRatePct: "12",
      invoicePrefix: "INV",
      priceIncludesTax: false,
      alertInApp: true,
      alertEmail: false,
      alertSms: false,
    },
  });

  // Populate the whole form once settings load — a single reset(), no side sync.
  useEffect(() => {
    if (data) {
      reset({
        legalName: data.company.legalName,
        addressLine1: data.company.addressLine1,
        city: data.company.city,
        state: data.company.state,
        pincode: data.company.pincode,
        phone: data.company.phone,
        email: data.company.email,
        drugLicenseNo: data.company.drugLicenseNo,
        gstin: data.company.gstin,
        taxEnabled: data.tax.enabled,
        defaultRatePct: String(data.tax.defaultRatePct),
        invoicePrefix: data.tax.invoicePrefix,
        priceIncludesTax: data.tax.priceIncludesTax,
        alertInApp: data.alertChannels.inApp,
        alertEmail: data.alertChannels.email,
        alertSms: data.alertChannels.sms,
      });
    }
  }, [data, reset]);

  const save = handleSubmit((f) =>
    mut.mutate({
      company: {
        legalName: f.legalName,
        addressLine1: f.addressLine1,
        city: f.city,
        state: f.state,
        pincode: f.pincode,
        phone: f.phone,
        email: f.email,
        drugLicenseNo: f.drugLicenseNo,
        gstin: f.gstin,
      },
      tax: {
        enabled: f.taxEnabled,
        defaultRatePct: Number(f.defaultRatePct) || 0,
        invoicePrefix: f.invoicePrefix,
        priceIncludesTax: f.priceIncludesTax,
      },
      alertChannels: {
        inApp: f.alertInApp,
        email: f.alertEmail,
        sms: f.alertSms,
      },
    }),
  );

  return (
    <Screen
      overline="Administration"
      title="Settings"
      subtitle={
        org?.name
          ? `${org.name} · company & invoice configuration`
          : "Configuration"
      }
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
      right={
        <Button
          label="Save"
          fullWidth={false}
          loading={mut.isPending}
          onPress={save}
        />
      }
    >
      {mut.isError && (
        <View style={errorBox}>
          <Text variant="body-sm" tone="danger">
            {apiErrorMessage(mut.error)}
          </Text>
        </View>
      )}
      {mut.isSuccess && (
        <View style={okBox}>
          <Text variant="body-sm" tone="success">
            Settings saved.
          </Text>
        </View>
      )}

      {/* Company profile */}
      <SectionHeader
        icon={Building2}
        title="Company & invoice header"
        subtitle="Printed on every invoice"
      />
      <Card style={{ marginBottom: 24 }}>
        <VStack gap={16}>
          <ControlledTextField
            control={control}
            name="legalName"
            label="Legal name"
            placeholder="Acme Pharmacy Pvt Ltd"
          />
          <ControlledTextField
            control={control}
            name="addressLine1"
            label="Address"
            placeholder="Street, area"
          />
          <HStack gap={12}>
            <View style={{ flex: 1 }}>
              <ControlledTextField control={control} name="city" label="City" />
            </View>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="state"
                label="State"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="pincode"
                label="PIN"
                keyboardType="number-pad"
              />
            </View>
          </HStack>
          <HStack gap={12}>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="phone"
                label="Phone"
                keyboardType="phone-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="email"
                label="Email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </HStack>
          <HStack gap={12} align="center">
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="drugLicenseNo"
                label="Drug license no."
                placeholder="MH-PH-…"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="gstin"
                label="GSTIN"
                autoCapitalize="characters"
              />
            </View>
          </HStack>
        </VStack>
      </Card>

      {/* Tax / GST */}
      <SectionHeader
        icon={Receipt}
        title="Tax & GST"
        subtitle="Used to compute invoice totals (SOW §9.1)"
      />
      <Card style={{ marginBottom: 24 }}>
        <VStack gap={16}>
          <HStack align="center" justify="space-between">
            <Text variant="label-lg" tone="primary">
              GST enabled
            </Text>
            <SwitchRow control={control} name="taxEnabled" />
          </HStack>
          <HStack gap={12}>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="defaultRatePct"
                label="Default GST rate (%)"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="invoicePrefix"
                label="Invoice prefix"
                autoCapitalize="characters"
              />
            </View>
          </HStack>
          <HStack align="center" justify="space-between">
            <VStack gap={2} flex={1}>
              <Text variant="label-lg" tone="primary">
                Prices include tax
              </Text>
              <Text variant="body-sm" tone="tertiary">
                If on, selling prices are treated as tax-inclusive.
              </Text>
            </VStack>
            <SwitchRow control={control} name="priceIncludesTax" />
          </HStack>
        </VStack>
      </Card>

      {/* Expiry alerts */}
      <SectionHeader
        icon={BellRing}
        title="Expiry alerts"
        subtitle="Thresholds (days) and delivery channels"
      />
      <Card style={{ marginBottom: 24 }}>
        <VStack gap={16}>
          <HStack gap={8} wrap>
            {(data?.expiryAlertDays || [90, 60, 30]).map((d) => (
              <StatusChip key={d} label={`${d} days`} tone="info" />
            ))}
          </HStack>
          {(
            [
              ["alertInApp", "In-app alerts"],
              ["alertEmail", "Email alerts"],
              ["alertSms", "SMS alerts"],
            ] as const
          ).map(([name, label]) => (
            <HStack key={name} align="center" justify="space-between">
              <Text variant="label-lg" tone="primary">
                {label}
              </Text>
              <SwitchRow control={control} name={name} />
            </HStack>
          ))}
        </VStack>
      </Card>

      <Button
        label="Save settings"
        size="lg"
        loading={mut.isPending}
        onPress={save}
      />
    </Screen>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: any;
  title: string;
  subtitle: string;
}) {
  return (
    <HStack gap={12} align="center" style={{ marginBottom: 12 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: palette.teal[50],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color={palette.teal[600]} strokeWidth={2} />
      </View>
      <VStack gap={1} flex={1}>
        <Text variant="h3" tone="primary">
          {title}
        </Text>
        <Text variant="caption" tone="tertiary">
          {subtitle}
        </Text>
      </VStack>
    </HStack>
  );
}

const errorBox = {
  padding: 14,
  borderRadius: radius.md,
  backgroundColor: palette.danger.bg,
  borderWidth: 1,
  borderColor: palette.danger.border,
  marginBottom: 16,
} as const;
const okBox = {
  padding: 14,
  borderRadius: radius.md,
  backgroundColor: palette.success.bg,
  borderWidth: 1,
  borderColor: palette.success.border,
  marginBottom: 16,
} as const;
