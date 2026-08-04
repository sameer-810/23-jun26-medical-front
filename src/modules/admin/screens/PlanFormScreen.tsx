import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useForm } from "react-hook-form";
import { Trash2 } from "lucide-react-native";
import {
  usePlans,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
} from "@modules/admin/hooks/useAdmin";
import { apiErrorMessage } from "@shared/api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  Card,
  Button,
  ConfirmDialog,
  BackLink,
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
    defaultValues: {
      name: "",
      code: "",
      description: "",
      priceMonthly: "",
      priceYearly: "",
      maxUsers: "",
      maxProducts: "",
      features: "",
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
      });
  }, [plan, reset]);

  const submit = handleSubmit((f) => {
    setServerError(null);
    const body = {
      name: f.name.trim(),
      description: f.description.trim(),
      priceMonthly: Number(f.priceMonthly) || 0,
      priceYearly: Number(f.priceYearly) || 0,
      maxUsers: Number(f.maxUsers) || 0,
      maxProducts: Number(f.maxProducts) || 0,
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
    <Screen overline="Plans" title={editing ? "Edit plan" : "Add plan"}>
      <BackLink label="Back to plans" onPress={() => navigation.goBack()} />

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
            name="priceMonthly"
            label="Price / month (₹)"
            keyboardType="numeric"
          />
          <ControlledTextField
            control={control}
            name="priceYearly"
            label="Price / year (₹)"
            keyboardType="numeric"
          />
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
