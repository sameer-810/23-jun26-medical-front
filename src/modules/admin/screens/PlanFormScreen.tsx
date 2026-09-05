import React, { useEffect, useState } from "react";
import { View, Switch, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react-native";
import {
  usePlans,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
} from "@modules/admin/hooks/useAdmin";
import { planSchema, optionalNumber } from "@modules/admin/admin.validation";
import { apiErrorMessage } from "@shared/api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  ConfirmDialog,
} from "@shared/ui";

export default function PlanFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string | undefined;
  const editing = Boolean(id);

  const { data: plans } = usePlans(true);
  const plan = plans?.find((p) => p._id === id);
  const createMut = useCreatePlan();
  const updateMut = useUpdatePlan(id || "");
  const deleteMut = useDeletePlan();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { control, handleSubmit, reset } = useForm({
    resolver: zodResolver(planSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      code: "",
      description: "",
      priceMonthly: "",
      priceYearly: "",
      maxUsers: "",
      maxProducts: "",
      features: "",
      termMonths: "",
      priceTotal: "",
      referencePrice: "",
      badge: "",
      tagline: "",
      sortOrder: "",
      isFeatured: false,
    },
  });

  useEffect(() => {
    if (plan)
      reset({
        name: plan.name,
        code: plan.code,
        description: plan.description || "",
        priceMonthly: String(plan.priceMonthly ?? ""),
        priceYearly: String(plan.priceYearly ?? ""),
        maxUsers: String(plan.maxUsers ?? ""),
        maxProducts: String(plan.maxProducts ?? ""),
        features: (plan.features || []).join(", "),
        termMonths: String(plan.termMonths ?? ""),
        priceTotal: String(plan.priceTotal ?? ""),
        // Blank means "derive it". Showing a 0 would read as a real ₹0 anchor.
        referencePrice: plan.referencePrice ? String(plan.referencePrice) : "",
        badge: plan.badge || "",
        tagline: plan.tagline || "",
        sortOrder: String(plan.sortOrder ?? ""),
        isFeatured: Boolean(plan.isFeatured),
      });
  }, [plan, reset]);

  const submit = handleSubmit((f) => {
    setServerError(null);
    const body = {
      name: f.name.trim(),
      description: f.description.trim(),
      // A price typo must not coerce to ₹0 — the schema refuses non-numbers,
      // and a blank box leaves the field to the server's own default.
      priceMonthly: optionalNumber(f.priceMonthly),
      priceYearly: optionalNumber(f.priceYearly),
      maxUsers: optionalNumber(f.maxUsers),
      maxProducts: optionalNumber(f.maxProducts),
      termMonths: optionalNumber(f.termMonths),
      priceTotal: optionalNumber(f.priceTotal),
      // 0, not undefined: clearing this box must actively drop a stored
      // override so the anchor goes back to being derived.
      referencePrice: f.referencePrice.trim() ? Number(f.referencePrice) : 0,
      badge: f.badge.trim(),
      tagline: f.tagline.trim(),
      sortOrder: optionalNumber(f.sortOrder),
      isFeatured: f.isFeatured,
      features: f.features
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const opts = {
      onSuccess: () => navigation.goBack(),
      onError: (err: unknown) => setServerError(apiErrorMessage(err)),
    };
    if (editing) updateMut.mutate(body, opts);
    else createMut.mutate({ ...body, code: f.code.trim().toLowerCase() }, opts);
  });

  const onDelete = () => {
    if (!id) return;
    deleteMut.mutate(id, { onSuccess: () => navigation.goBack() });
  };

  return (
    <Screen
      back="Back to plans"
      overline="Plans"
      title={editing ? "Edit plan" : "Add plan"}
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
            label="Plan name"
          />
          {!editing ? (
            <ControlledTextField
              control={control}
              name="code"
              label="Code (unique, e.g. pro)"
              autoCapitalize="none"
            />
          ) : null}
          <ControlledTextField
            control={control}
            name="description"
            label="Description"
          />
          <ControlledTextField
            control={control}
            name="tagline"
            label="Tagline (the line under the plan name on the card)"
          />
        </VStack>
      </Card>

      {/* ---- How the plan is sold ----
          A term and one payment for it. These two are what a price card is
          built from; the model could not express a 3- or 6-month term at all
          before this, which is why the console only ever held one plan. */}
      <Card style={{ marginBottom: 16 }}>
        <VStack gap={16}>
          <VStack gap={2}>
            <Text variant="label-lg" tone="primary">
              How it&apos;s sold
            </Text>
            <Text variant="caption" tone="tertiary">
              The term and the one payment for it. Leave the anchor and badge
              blank and they derive themselves from the 1-month plan, so a
              change to the monthly price moves every discount with it.
            </Text>
          </VStack>
          <ControlledTextField
            control={control}
            name="termMonths"
            label="Term (months)"
            keyboardType="number-pad"
          />
          <ControlledTextField
            control={control}
            name="priceTotal"
            label="Once total (₹) — what is actually charged"
            keyboardType="numeric"
          />
          <ControlledTextField
            control={control}
            name="priceMonthly"
            label="Price / month (₹) — the headline rate on the card"
            keyboardType="numeric"
          />
          <ControlledTextField
            control={control}
            name="referencePrice"
            label="Strikethrough 'Instead of' (₹) — blank to derive"
            keyboardType="numeric"
          />
          <ControlledTextField
            control={control}
            name="badge"
            label="Discount tag — blank to derive, e.g. Save 78%"
          />
          <ControlledTextField
            control={control}
            name="sortOrder"
            label="Card order (low first)"
            keyboardType="number-pad"
          />
          <HStack gap={12} align="center" justify="space-between">
            <VStack gap={2} flex={1}>
              <Text variant="body" tone="secondary">
                Best value
              </Text>
              <Text variant="caption" tone="tertiary">
                The one raised card. Turning this on turns it off everywhere
                else — a list that recommends two plans recommends neither.
              </Text>
            </VStack>
            <Controller
              control={control}
              name="isFeatured"
              render={({ field }) => (
                <Switch
                  value={field.value}
                  onValueChange={field.onChange}
                  trackColor={{
                    false: palette.neutral[300],
                    true: palette.teal[400],
                  }}
                  thumbColor={
                    field.value ? palette.teal[600] : palette.neutral[50]
                  }
                />
              )}
            />
          </HStack>
        </VStack>
      </Card>

      {/* ---- Quotas ---- */}
      <Card style={{ marginBottom: 16 }}>
        <VStack gap={16}>
          <ControlledTextField
            control={control}
            name="maxUsers"
            label="Max users (0 = unlimited)"
            keyboardType="number-pad"
          />
          <ControlledTextField
            control={control}
            name="maxProducts"
            label="Max products (0 = unlimited)"
            keyboardType="number-pad"
          />
          <ControlledTextField
            control={control}
            name="priceYearly"
            label="Price / year (₹) — legacy, nothing reads it"
            keyboardType="numeric"
          />
          <ControlledTextField
            control={control}
            name="features"
            label="Features (comma separated)"
          />
        </VStack>
      </Card>

      <Button
        label={editing ? "Save changes" : "Add plan"}
        size="lg"
        loading={createMut.isPending || updateMut.isPending}
        onPress={submit}
      />

      {editing ? (
        <Button
          label="Delete plan"
          variant="destructive"
          icon={<Trash2 size={16} color="#FFFFFF" strokeWidth={2} />}
          style={{ marginTop: 16 }}
          loading={deleteMut.isPending}
          onPress={() => setConfirmOpen(true)}
        />
      ) : null}

      <ConfirmDialog
        visible={confirmOpen}
        title="Delete this plan?"
        confirmLabel="Delete"
        destructive
        loading={deleteMut.isPending}
        onConfirm={onDelete}
        onCancel={() => setConfirmOpen(false)}
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
