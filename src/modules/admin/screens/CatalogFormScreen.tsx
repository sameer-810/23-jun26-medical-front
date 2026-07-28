import React, { useEffect, useState } from "react";
import { View, Switch, Platform, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useForm, Controller } from "react-hook-form";
import { ArrowLeft, Trash2 } from "lucide-react-native";
import {
  useCatalogProduct,
  useCreateCatalog,
  useUpdateCatalog,
  useDeleteCatalog,
} from "@modules/admin/hooks/useAdmin";
import { apiErrorMessage } from "@shared/api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius } from "@shared/designSystem";
import { Screen, Text, VStack, HStack, Card, Button } from "@shared/ui";

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

  const { control, handleSubmit, reset } = useForm({
    defaultValues: {
      sku: "",
      name: "",
      saltComposition: "",
      manufacturerName: "",
      mrp: "",
      productForm: "",
      packLabel: "",
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
        prescriptionRequired: product.prescriptionRequired,
      });
  }, [product, reset]);

  const submit = handleSubmit((f) => {
    setServerError(null);
    const body = {
      name: f.name.trim(),
      saltComposition: f.saltComposition.trim(),
      manufacturerName: f.manufacturerName.trim(),
      mrp: Number(f.mrp) || 0,
      productForm: f.productForm.trim(),
      packLabel: f.packLabel.trim(),
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
    if (Platform.OS === "web" && !window.confirm("Delete this product?"))
      return;
    deleteMut.mutate(id, { onSuccess: () => navigation.goBack() });
  };

  const busy = createMut.isPending || updateMut.isPending;

  return (
    <Screen
      overline="Catalogue"
      title={editing ? "Edit product" : "Add product"}
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
          onPress={onDelete}
        />
      ) : null}
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
