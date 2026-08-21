import React, { useEffect, useRef, useState } from "react";
import { View, Switch, Image, Platform } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  Receipt,
  BellRing,
  DatabaseBackup,
  Boxes,
} from "lucide-react-native";
import {
  useSettings,
  useUpdateSettings,
  useEmailBackup,
} from "@modules/settings/hooks/useSettings";
import {
  settingsSchema,
  parseDays,
  parseUnits,
  SETTINGS_FIELD_LABELS,
} from "@modules/settings/settings.validation";
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
  Banner,
  StatusChip,
  ConfirmDialog,
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
  const backupMut = useEmailBackup();
  const org = useAuthStore((s) => s.organization);

  const { control, handleSubmit, reset } = useForm({
    resolver: zodResolver(settingsSchema),
    mode: "onTouched",
    defaultValues: {
      legalName: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      pincode: "",
      phone: "",
      email: "",
      drugLicenseNo: "",
      gstin: "",
      signatureLabel: "",
      taxEnabled: true,
      defaultRatePct: "12",
      invoicePrefix: "INV",
      priceIncludesTax: false,
      currency: "INR",
      expiryAlertDays: "90, 60, 30",
      units: "",
      defaultReorderLevel: "0",
      alertInApp: true,
      alertEmail: false,
      alertSms: false,
      backupEmail: "",
    },
  });

  /** Fields that blocked the last submit. The Save button is four screens above them. */
  const [invalidFields, setInvalidFields] = useState<string[]>([]);

  /**
   * The signature lives outside react-hook-form.
   *
   * It is a ~100 KB data URI, and threading that through form state re-runs
   * validation on every keystroke elsewhere in the form. It is set once and
   * read once, so a plain state value is the honest shape for it.
   */
  /**
   * Derived, not synced. Holding it in state and copying the loaded value in
   * with an effect meant a setState during render — cascading renders, and the
   * linter rightly refuses it. The saved value is the base; an edit overrides
   * it until the next save.
   */
  const [sigOverride, setSigOverride] = useState<string | null>(null);
  const signature = sigOverride ?? data?.company.signatureImage ?? "";
  const [sigError, setSigError] = useState<string | null>(null);
  const sigInputRef = useRef<HTMLInputElement | null>(null);

  const pickSignature = () => {
    setSigError(null);
    if (Platform.OS === "web") sigInputRef.current?.click();
    else setSigError("Signature upload is available on the web app.");
  };

  const onSignatureFile = (e: { target: { files: FileList | null } }) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 1 MB of image is ~1.37 MB of base64; the API caps the field at 1.4 MB.
    if (file.size > 1_000_000) {
      setSigError(
        "That image is over 1 MB. Use a smaller crop of the signature.",
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSigOverride(String(reader.result || ""));
    reader.onerror = () =>
      setSigError("Couldn't read that file. Try another image.");
    reader.readAsDataURL(file);
  };

  // Populate the whole form once settings load — a single reset(), no side sync.
  useEffect(() => {
    if (data) {
      reset({
        legalName: data.company.legalName,
        addressLine1: data.company.addressLine1,
        addressLine2: data.company.addressLine2 || "",
        city: data.company.city,
        state: data.company.state,
        pincode: data.company.pincode,
        phone: data.company.phone,
        email: data.company.email,
        drugLicenseNo: data.company.drugLicenseNo,
        gstin: data.company.gstin,
        signatureLabel: data.company.signatureLabel || "",
        taxEnabled: data.tax.enabled,
        defaultRatePct: String(data.tax.defaultRatePct),
        invoicePrefix: data.tax.invoicePrefix,
        priceIncludesTax: data.tax.priceIncludesTax,
        currency: data.currency || "INR",
        expiryAlertDays: (data.expiryAlertDays || []).join(", "),
        units: (data.units || []).join(", "),
        defaultReorderLevel: String(data.defaultReorderLevel ?? 0),
        alertInApp: data.alertChannels.inApp,
        alertEmail: data.alertChannels.email,
        alertSms: data.alertChannels.sms,
        backupEmail: data.backupEmail || "",
      });
    }
  }, [data, reset]);

  const save = handleSubmit(
    (f) => {
      setInvalidFields([]);
      mut.mutate({
        company: {
          legalName: f.legalName,
          addressLine1: f.addressLine1,
          addressLine2: f.addressLine2,
          city: f.city,
          state: f.state,
          pincode: f.pincode,
          phone: f.phone,
          email: f.email,
          drugLicenseNo: f.drugLicenseNo,
          gstin: f.gstin,
          signatureLabel: f.signatureLabel,
          signatureImage: signature,
        },
        tax: {
          enabled: f.taxEnabled,
          defaultRatePct: Number(f.defaultRatePct) || 0,
          invoicePrefix: f.invoicePrefix,
          priceIncludesTax: f.priceIncludesTax,
        },
        currency: f.currency,
        expiryAlertDays: parseDays(f.expiryAlertDays),
        units: parseUnits(f.units),
        defaultReorderLevel: Number(f.defaultReorderLevel),
        alertChannels: {
          inApp: f.alertInApp,
          email: f.alertEmail,
          sms: f.alertSms,
        },
        backupEmail: f.backupEmail,
      });
    },
    // A zod failure otherwise fires nothing at all, and the only sign is an
    // inline error far below the sticky Save button.
    (errors) => setInvalidFields(Object.keys(errors)),
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
      {invalidFields.length > 0 && (
        <Banner
          tone="danger"
          title="Not saved — some fields need fixing"
          message={invalidFields
            .map((f) => SETTINGS_FIELD_LABELS[f] || f)
            .join(", ")}
          style={{ marginBottom: 16 }}
        />
      )}
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
            label="Address line 1"
            placeholder="Street, area"
          />
          {/* Prints as the second address line on the GST invoice. */}
          <ControlledTextField
            control={control}
            name="addressLine2"
            label="Address line 2 (optional)"
            placeholder="Landmark, building"
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

          {/*
            Owner signature / shop stamp for the invoice footer.

            Held as a data URI rather than an uploaded file: the invoice is
            printed from an offline HTML document, and a print dialog that has
            to fetch an image over the network prints an empty box often enough
            to be worse than no signature at all.
          */}
          <VStack gap={8}>
            <Text variant="label" tone="secondary">
              Signature / stamp on invoice
            </Text>
            <HStack gap={12} align="center" wrap>
              <View style={sigPreview}>
                {signature ? (
                  <Image
                    source={{ uri: signature }}
                    style={{ width: 150, height: 52 }}
                    resizeMode="contain"
                  />
                ) : (
                  <Text variant="caption" tone="tertiary">
                    No signature yet
                  </Text>
                )}
              </View>
              <VStack gap={8}>
                <Button
                  label={signature ? "Replace image" : "Upload image"}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onPress={pickSignature}
                />
                {signature ? (
                  <Button
                    label="Remove"
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    onPress={() => setSigOverride("")}
                  />
                ) : null}
              </VStack>
            </HStack>
            <ControlledTextField
              control={control}
              name="signatureLabel"
              label="Caption under the signature (optional)"
              placeholder="For Ismail Medical & General Stores"
            />
            <Text variant="caption" tone="tertiary">
              PNG or JPG, under 1 MB. Leave empty to print a blank ruled line to
              sign by hand.
            </Text>
            {sigError ? (
              <Text variant="caption" tone="danger">
                {sigError}
              </Text>
            ) : null}
            {Platform.OS === "web" ? (
              <input
                ref={sigInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={onSignatureFile}
              />
            ) : null}
          </VStack>
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
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="currency"
                label="Currency code"
                autoCapitalize="characters"
                placeholder="INR"
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
          <VStack gap={6}>
            <ControlledTextField
              control={control}
              name="expiryAlertDays"
              label="Alert thresholds (days before expiry)"
              placeholder="90, 60, 30"
              keyboardType="numbers-and-punctuation"
            />
            {/* Saved thresholds, so an unsaved edit is visibly an edit. */}
            <HStack gap={8} wrap>
              {(data?.expiryAlertDays || []).map((d) => (
                <StatusChip key={d} label={`${d} days`} tone="info" />
              ))}
            </HStack>
            <Text variant="caption" tone="tertiary">
              Comma separated, up to 6 thresholds between 1 and 365 days.
            </Text>
          </VStack>
          {/*
            In-app alerts are free and behave like any other switch. Email and
            SMS cost the platform real money per message, so turning one on is a
            commercial decision — the price is stated before it flips, and the
            price is per pharmacy because that is how it is actually sold.
          */}
          <HStack align="center" justify="space-between">
            <Text variant="label-lg" tone="primary">
              In-app alerts
            </Text>
            <SwitchRow control={control} name="alertInApp" />
          </HStack>
          <PaidAlertRow
            control={control}
            name="alertEmail"
            label="Email alerts"
            price={data?.alertPricing?.emailMonthly ?? 0}
            currency={data?.alertPricing?.currency || "INR"}
          />
          <PaidAlertRow
            control={control}
            name="alertSms"
            label="SMS alerts"
            price={data?.alertPricing?.smsMonthly ?? 0}
            currency={data?.alertPricing?.currency || "INR"}
          />
        </VStack>
      </Card>

      {/* Stock defaults */}
      <SectionHeader
        icon={Boxes}
        title="Stock defaults"
        subtitle="Units offered on products, and the fallback reorder level"
      />
      <Card style={{ marginBottom: 24 }}>
        <VStack gap={16}>
          <VStack gap={6}>
            <ControlledTextField
              control={control}
              name="units"
              label="Units"
              placeholder="pcs, strip, bottle, box"
              autoCapitalize="none"
            />
            <Text variant="caption" tone="tertiary">
              Comma separated. These are the units offered when adding a
              product.
            </Text>
          </VStack>
          <ControlledTextField
            control={control}
            name="defaultReorderLevel"
            label="Default reorder level"
            keyboardType="number-pad"
          />
        </VStack>
      </Card>

      {/* Data backup */}
      <SectionHeader
        icon={DatabaseBackup}
        title="Data backup"
        subtitle="A copy of everything, sent to your email"
      />
      <Card style={{ marginBottom: 24 }}>
        <VStack gap={12}>
          <Text variant="body-sm" tone="secondary">
            Emails a zip with all your data — products, stock, sales, purchases,
            customers and suppliers — as a spreadsheet plus restore files. Save
            it to your Google Drive or keep it anywhere safe.
          </Text>
          <ControlledTextField
            control={control}
            name="backupEmail"
            label="Send backups to (email)"
            placeholder="Leave empty to use your login email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text variant="caption" tone="tertiary">
            Backups go to this address. Tap Save settings after changing it —
            the button below uses the saved address.
          </Text>
          <Button
            label="Email my backup"
            variant="secondary"
            fullWidth={false}
            loading={backupMut.isPending}
            onPress={() => backupMut.mutate()}
          />
          {backupMut.isSuccess && (
            <Text variant="body-sm" tone="success">
              Backup sent to {backupMut.data.emailedTo}. Check your inbox (it
              can take a minute to arrive).
            </Text>
          )}
          {backupMut.isError && (
            <Text variant="body-sm" tone="danger">
              {apiErrorMessage(backupMut.error)}
            </Text>
          )}
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

/** Fixed-size well so the row doesn't jump when a signature is chosen. */
const sigPreview = {
  width: 170,
  height: 64,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: palette.border.default,
  backgroundColor: palette.surface.secondary,
  alignItems: "center",
  justifyContent: "center",
} as const;

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

/**
 * A metered alert channel: states the price before it switches on.
 *
 * Turning email or SMS alerts on costs the pharmacy money, so it must not
 * behave like the free in-app toggle. The price shown is the one the platform
 * set for THIS pharmacy — quoted per customer, which is why it comes from the
 * organisation rather than a global rate.
 *
 * Where no price has been quoted yet, we ask them to request the service
 * instead of inventing a number: showing "₹0" would read as free.
 */
function PaidAlertRow({
  control,
  name,
  label,
  price,
  currency,
}: {
  control: any;
  name: string;
  label: string;
  price: number;
  currency: string;
}) {
  const [asking, setAsking] = React.useState<null | (() => void)>(null);
  const money = (n: number) =>
    `${currency === "INR" ? "₹" : currency + " "}${n.toLocaleString("en-IN")}`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <>
          <HStack align="center" justify="space-between">
            <VStack gap={2} flex={1}>
              <HStack gap={8} align="center" wrap>
                <Text variant="label-lg" tone="primary">
                  {label}
                </Text>
                <StatusChip
                  label={
                    price > 0 ? `${money(price)}/month` : "Price on request"
                  }
                  tone={price > 0 ? "warning" : "neutral"}
                />
              </HStack>
              <Text variant="caption" tone="tertiary">
                {field.value
                  ? "Chargeable service — billed by the platform team."
                  : "Paid add-on. You'll be shown the price before it's enabled."}
              </Text>
            </VStack>
            <Switch
              value={field.value}
              onValueChange={(next) => {
                // Only switching ON needs consent; switching off is free.
                if (!next) return field.onChange(false);
                setAsking(() => () => field.onChange(true));
              }}
              trackColor={{ true: palette.teal[500], false: palette.ink[200] }}
              thumbColor="#FFFFFF"
            />
          </HStack>

          <ConfirmDialog
            visible={Boolean(asking)}
            title={`Turn on ${label.toLowerCase()}?`}
            message={
              price > 0
                ? `${label} are charged at ${money(price)} per month, set by the platform team for this pharmacy. Turning this on requests the service — you will be billed from activation.`
                : `${label} are a paid add-on and no price has been set for this pharmacy yet. Turning this on sends a request to the platform team, who will confirm the price before the service starts.`
            }
            confirmLabel={
              price > 0 ? "Turn on and accept charge" : "Request service"
            }
            onConfirm={() => {
              asking?.();
              setAsking(null);
            }}
            onCancel={() => setAsking(null)}
          />
        </>
      )}
    />
  );
}
