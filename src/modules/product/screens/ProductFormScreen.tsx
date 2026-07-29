import React, { useEffect, useState } from "react";
import { View, Switch } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react-native";
import {
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useRemoveProduct,
  useCategories,
  useBrands,
  useCreateCategory,
  useCreateBrand,
} from "@modules/product/hooks/useProducts";
import { productSchema } from "@modules/product/product.validation";
import { PackUnit, ScheduleDrug } from "@modules/product/types";
import { apiErrorMessage } from "@api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { ControlledSelect } from "@shared/form/ControlledSelect";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  ConfirmDialog,
  BackLink,
} from "@shared/ui";
import { PacksEditor } from "@modules/product/components/PacksEditor";

const SCHEDULES: { value: ScheduleDrug; label: string }[] = [
  { value: "", label: "None" },
  { value: "H", label: "Schedule H" },
  { value: "H1", label: "Schedule H1" },
  { value: "X", label: "Schedule X" },
  { value: "G", label: "Schedule G" },
  { value: "C", label: "Schedule C" },
];

export default function ProductFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string | undefined;
  const editing = Boolean(id);

  const { data: product } = useProduct(id || "");
  const { data: categories } = useCategories();
  const { data: brands } = useBrands();
  const createCategory = useCreateCategory();
  const createBrand = useCreateBrand();
  const createMut = useCreateProduct();
  const updateMut = useUpdateProduct(id || "");
  const removeMut = useRemoveProduct();
  const mut = editing ? updateMut : createMut;
  const [confirmOpen, setConfirmOpen] = useState(false);

  // One form holds every value — text, numbers, dropdowns, switch and packs —
  // so the edit screen populates with a single reset() and nothing side-syncs.
  const { control, handleSubmit, reset } = useForm({
    resolver: zodResolver(productSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      saltComposition: "",
      baseUnit: "pcs",
      sellingPrice: "",
      mrp: "",
      taxRatePct: "",
      hsnCode: "",
      reorderLevel: "",
      categoryId: null as string | null,
      brandId: null as string | null,
      scheduleDrug: "" as string,
      prescriptionRequired: false,
      packs: [] as PackUnit[],
    },
  });
  // PacksEditor needs the live base unit as it's typed. useWatch (not watch())
  // is the render-safe, React-Compiler-compatible way to subscribe to a field.
  const baseUnit = useWatch({ control, name: "baseUnit" });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        saltComposition: product.saltComposition || "",
        baseUnit: product.baseUnit,
        sellingPrice: String(product.sellingPrice),
        mrp: String(product.mrp),
        taxRatePct: String(product.taxRatePct),
        hsnCode: product.hsnCode,
        reorderLevel: String(product.reorderLevel),
        categoryId: product.categoryId,
        brandId: product.brandId,
        scheduleDrug: product.scheduleDrug,
        prescriptionRequired: product.prescriptionRequired,
        packs: product.packs,
      });
    }
  }, [product, reset]);

  const submit = handleSubmit((f) => {
    const payload = {
      name: f.name.trim(),
      sku: f.sku.trim() || undefined,
      barcode: f.barcode.trim() || undefined,
      saltComposition: f.saltComposition.trim() || undefined,
      categoryId: f.categoryId,
      brandId: f.brandId,
      baseUnit: f.baseUnit.trim() || "pcs",
      packs: f.packs.filter((p) => p.unit.trim() && p.factor > 0),
      sellingPrice: Number(f.sellingPrice) || 0,
      mrp: Number(f.mrp) || 0,
      taxRatePct: f.taxRatePct === "" ? undefined : Number(f.taxRatePct),
      hsnCode: f.hsnCode.trim(),
      reorderLevel: f.reorderLevel === "" ? undefined : Number(f.reorderLevel),
      prescriptionRequired: f.prescriptionRequired,
      scheduleDrug: f.scheduleDrug as ScheduleDrug,
    };
    mut.mutate(payload as never, { onSuccess: () => navigation.goBack() });
  });

  const categoryOptions = (categories || []).map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const brandOptions = (brands || []).map((b) => ({
    value: b.id,
    label: b.name,
  }));

  return (
    <Screen
      overline="Catalogue"
      title={editing ? "Edit product" : "Add product"}
      subtitle={editing ? product?.sku : "Define a catalogue item"}
    >
      <BackLink label="Back to products" onPress={() => navigation.goBack()} />

      {mut.isError && (
        <View style={errorBox}>
          <Text variant="body-sm" tone="danger">
            {apiErrorMessage(mut.error)}
          </Text>
        </View>
      )}

      {/* Identity */}
      <Card style={{ marginBottom: 16 }}>
        <VStack gap={16}>
          <ControlledTextField
            control={control}
            name="name"
            label="Product name"
            placeholder="Amoxicillin 500mg"
          />
          <HStack gap={12}>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="sku"
                label="SKU"
                placeholder="Auto-generated"
                autoCapitalize="characters"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="barcode"
                label="Barcode"
                placeholder="EAN / UPC"
                keyboardType="number-pad"
              />
            </View>
          </HStack>
          {/* Staff search by molecule as often as by brand ("something with
              pantoprazole"), and substitutes are chosen on the salt. */}
          <ControlledTextField
            control={control}
            name="saltComposition"
            label="Salt / composition"
            placeholder="e.g. Paracetamol 500mg + Caffeine 30mg"
          />
          <ControlledSelect
            control={control}
            name="categoryId"
            label="Category"
            options={categoryOptions}
            onCreate={async (label) => {
              const cat = await createCategory.mutateAsync(label);
              return { value: cat.id, label: cat.name };
            }}
            allowClear
          />
          <ControlledSelect
            control={control}
            name="brandId"
            label="Brand"
            options={brandOptions}
            onCreate={async (label) => {
              const b = await createBrand.mutateAsync(label);
              return { value: b.id, label: b.name };
            }}
            allowClear
          />
        </VStack>
      </Card>

      {/* Units */}
      <Text variant="h3" tone="primary" style={{ marginBottom: 12 }}>
        Units of measure
      </Text>
      <Card style={{ marginBottom: 16 }}>
        <VStack gap={16}>
          <ControlledTextField
            control={control}
            name="baseUnit"
            label="Base unit"
            placeholder="tablet / pcs / ml"
          />
          <Controller
            control={control}
            name="packs"
            render={({ field }) => (
              <PacksEditor
                baseUnit={baseUnit}
                packs={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </VStack>
      </Card>

      {/* Pricing */}
      <Text variant="h3" tone="primary" style={{ marginBottom: 12 }}>
        Pricing & tax
      </Text>
      <Card style={{ marginBottom: 16 }}>
        <VStack gap={16}>
          <HStack gap={12}>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="sellingPrice"
                label="Selling price (₹)"
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="mrp"
                label="MRP (₹)"
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </View>
          </HStack>
          <HStack gap={12}>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="taxRatePct"
                label="GST %"
                keyboardType="decimal-pad"
                placeholder="from settings"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="hsnCode"
                label="HSN code"
                placeholder="3004"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="reorderLevel"
                label="Reorder level"
                keyboardType="number-pad"
                placeholder="from settings"
              />
            </View>
          </HStack>
        </VStack>
      </Card>

      {/* Pharma */}
      <Text variant="h3" tone="primary" style={{ marginBottom: 12 }}>
        Pharmacy
      </Text>
      <Card style={{ marginBottom: 20 }}>
        <VStack gap={16}>
          <HStack align="center" justify="space-between">
            <VStack gap={2} flex={1}>
              <Text variant="label-lg" tone="primary">
                Prescription required
              </Text>
              <Text variant="body-sm" tone="tertiary">
                Warn at point of sale (Rx / Schedule drugs).
              </Text>
            </VStack>
            <Controller
              control={control}
              name="prescriptionRequired"
              render={({ field }) => (
                <Switch
                  value={field.value}
                  onValueChange={field.onChange}
                  trackColor={{
                    true: palette.teal[500],
                    false: palette.ink[200],
                  }}
                  thumbColor="#FFFFFF"
                />
              )}
            />
          </HStack>
          <ControlledSelect
            control={control}
            name="scheduleDrug"
            label="Drug schedule"
            options={SCHEDULES.map((s) => ({ value: s.value, label: s.label }))}
          />
        </VStack>
      </Card>

      <Button
        label={editing ? "Save changes" : "Create product"}
        size="lg"
        loading={mut.isPending}
        onPress={submit}
      />

      {editing && product?.isActive && (
        <Button
          label="Deactivate product"
          variant="destructive"
          icon={<Trash2 size={16} color="#FFFFFF" strokeWidth={2} />}
          style={{ marginTop: 12 }}
          loading={removeMut.isPending}
          onPress={() => setConfirmOpen(true)}
        />
      )}

      <ConfirmDialog
        visible={confirmOpen}
        title="Deactivate this product?"
        message="History is preserved."
        confirmLabel="Deactivate"
        destructive
        loading={removeMut.isPending}
        onConfirm={() =>
          removeMut.mutate(id!, { onSuccess: () => navigation.goBack() })
        }
        onCancel={() => setConfirmOpen(false)}
      />
    </Screen>
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
