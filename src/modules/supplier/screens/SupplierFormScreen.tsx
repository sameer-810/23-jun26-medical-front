import React, { useEffect } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Truck, User, Phone, Mail } from "lucide-react-native";
import {
  useSupplier,
  useCreateSupplier,
  useUpdateSupplier,
} from "@modules/supplier/hooks/useSuppliers";
import { supplierSchema } from "@modules/supplier/supplier.validation";
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
  BackLink,
} from "@shared/ui";

export default function SupplierFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string | undefined;
  const editing = Boolean(id);
  const { data: supplier } = useSupplier(id || "");
  const createMut = useCreateSupplier();
  const updateMut = useUpdateSupplier(id || "");
  const mut = editing ? updateMut : createMut;

  const { control, handleSubmit, reset } = useForm({
    resolver: zodResolver(supplierSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      contactPerson: "",
      mobile: "",
      email: "",
      address: "",
      gstin: "",
    },
  });
  useEffect(() => {
    if (supplier)
      reset({
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        mobile: supplier.mobile,
        email: supplier.email,
        address: supplier.address,
        gstin: supplier.gstin,
      });
  }, [supplier, reset]);

  const submit = handleSubmit((f) =>
    mut.mutate(
      {
        name: f.name.trim(),
        contactPerson: f.contactPerson.trim() || undefined,
        mobile: f.mobile.trim() || undefined,
        email: f.email.trim() || undefined,
        address: f.address.trim() || undefined,
        gstin: f.gstin.trim() || undefined,
      },
      { onSuccess: () => navigation.goBack() },
    ),
  );

  return (
    <Screen
      overline="Suppliers"
      title={editing ? "Edit supplier" : "Add supplier"}
    >
      <BackLink label="Back" onPress={() => navigation.goBack()} />
      {mut.isError && (
        <View style={errorBox}>
          <Text variant="body-sm" tone="danger">
            {apiErrorMessage(mut.error)}
          </Text>
        </View>
      )}
      <Card style={{ marginBottom: 16 }}>
        <VStack gap={12}>
          <HStack gap={12} wrap>
            <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 150 }}>
              <ControlledTextField
                control={control}
                name="name"
                label="Supplier name"
                leading={
                  <Truck
                    size={18}
                    color={palette.text.tertiary}
                    strokeWidth={1.8}
                  />
                }
                placeholder="MedSupply Co"
              />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 150 }}>
              <ControlledTextField
                control={control}
                name="contactPerson"
                label="Contact person"
                leading={
                  <User
                    size={18}
                    color={palette.text.tertiary}
                    strokeWidth={1.8}
                  />
                }
              />
            </View>
          </HStack>
          <HStack gap={12} wrap>
            <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 150 }}>
              <ControlledTextField
                control={control}
                name="mobile"
                label="Mobile"
                leading={
                  <Phone
                    size={18}
                    color={palette.text.tertiary}
                    strokeWidth={1.8}
                  />
                }
                keyboardType="phone-pad"
              />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 150 }}>
              <ControlledTextField
                control={control}
                name="email"
                label="Email"
                leading={
                  <Mail
                    size={18}
                    color={palette.text.tertiary}
                    strokeWidth={1.8}
                  />
                }
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </HStack>
          <HStack gap={12} wrap>
            <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 150 }}>
              <ControlledTextField
                control={control}
                name="address"
                label="Address"
              />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 150 }}>
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
      <Button
        label={editing ? "Save changes" : "Add supplier"}
        size="lg"
        loading={mut.isPending}
        onPress={submit}
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
