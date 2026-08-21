import React, { useEffect, useState } from "react";
import { View, Switch, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react-native";
import {
  useCatalogProduct,
  useCreateCatalog,
  useUpdateCatalog,
  useDeleteCatalog,
} from "@modules/admin/hooks/useAdmin";
import {
  catalogProductSchema,
  optionalNumber,
} from "@modules/admin/admin.validation";
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

export default function CatalogFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string | undefined;
  const editing = Boolean(id);

  const { data: product } = useCatalogProduct(id);
  const createMut = useCreateCatalog();
  const updateMut = useUpdateCatalog(id || "");
  const deleteMut = useDeleteCatalog();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { control, handleSubmit, reset } = useForm({
    resolver: zodResolver(catalogProductSchema),
    mode: "onTouched",
    defaultValues: {
      sku: "",
      name: "",
      saltComposition: "",
      manufacturerName: "",
      mrp: "",
      productForm: "",
      packLabel: "",
      packUnit: "",
      packQty: "",
      baseUnit: "",
      hsnCode: "",
      prescriptionRequired: false,
    },
  });

  useEffect(() => {
    if (product)
      reset({
        sku: product.sku,
        name: product.name,
        saltComposition: product.saltComposition,
        manufacturerName: product.manufacturerName,
        mrp: String(product.mrp ?? ""),
        productForm: product.productForm,
        packLabel: product.packLabel,
        packUnit: product.packUnit || "",
        packQty: product.packQty ? String(product.packQty) : "",
        baseUnit: product.baseUnit || "",
        hsnCode: product.hsnCode || "",
        prescriptionRequired: product.prescriptionRequired,
      });
  }, [product, reset]);

  const submit = handleSubmit((f) => {
    setServerError(null);
    const body = {
      name: f.name.trim(),
      saltComposition: f.saltComposition.trim(),
      manufacturerName: f.manufacturerName.trim(),
      mrp: optionalNumber(f.mrp),
      productForm: f.productForm.trim(),
      packLabel: f.packLabel.trim(),
      packUnit: f.packUnit.trim(),
      packQty: optionalNumber(f.packQty),
      baseUnit: f.baseUnit.trim(),
      hsnCode: f.hsnCode.trim(),
      prescriptionRequired: f.prescriptionRequired,
    };
    const opts = {
      onSuccess: () => navigation.goBack(),
      onError: (err: unknown) => setServerError(apiErrorMessage(err)),
    };
    if (editing) updateMut.mutate(body, opts);
    else createMut.mutate({ ...body, sku: f.sku.trim() }, opts);
  });

  const onDelete = () => {
    if (!id) return;
    deleteMut.mutate(id, { onSuccess: () => navigation.goBack() });
  };

  const busy = createMut.isPending || updateMut.isPending;

  return (
    <Screen
      back="Back to catalogue"
      overline="Catalogue"
      title={editing ? "Edit product" : "Add product"}
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
          {!editing ? (
            <ControlledTextField
              control={control}
              name="sku"
              label="SKU (unique)"
              autoCapitalize="characters"
            />
          ) : null}
          <ControlledTextField control={control} name="name" label="Name" />
          <ControlledTextField
            control={control}
            name="saltComposition"
            label="Composition (salt)"
          />
          <ControlledTextField
            control={control}
            name="manufacturerName"
            label="Manufacturer"
          />
          <ControlledTextField
            control={control}
            name="mrp"
            label="MRP (₹)"
            keyboardType="numeric"
          />
          <ControlledTextField
            control={control}
            name="productForm"
            label="Form (Tablet / Syrup…)"
          />
          <ControlledTextField
            control={control}
            name="packLabel"
            label="Pack (e.g. strip of 10 tablets)"
          />
          {/* Pack hierarchy and HSN: without these an imported product cannot
              be sold by strip and prints a blank HSN on every invoice line. */}
          <HStack gap={12}>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="packUnit"
                label="Pack unit (Strip / Bottle)"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="packQty"
                label="Base units per pack"
                keyboardType="number-pad"
              />
            </View>
          </HStack>
          <HStack gap={12}>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="baseUnit"
                label="Base unit (defaults to pcs)"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="hsnCode"
                label="HSN code"
                keyboardType="number-pad"
              />
            </View>
          </HStack>
          <Controller
            control={control}
            name="prescriptionRequired"
            render={({ field }) => (
              <HStack gap={12} align="center" justify="space-between">
                <Text variant="body" tone="secondary">
                  Prescription required
                </Text>
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
              </HStack>
            )}
          />
        </VStack>
      </Card>

      <Button
        label={editing ? "Save changes" : "Add product"}
        size="lg"
        loading={busy}
        onPress={submit}
      />

      {editing ? (
        <Button
          label="Delete product"
          variant="destructive"
          icon={<Trash2 size={16} color="#FFFFFF" strokeWidth={2} />}
          style={{ marginTop: 16 }}
          loading={deleteMut.isPending}
          onPress={() => setConfirmOpen(true)}
        />
      ) : null}

      <ConfirmDialog
        visible={confirmOpen}
        title="Delete this product?"
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
