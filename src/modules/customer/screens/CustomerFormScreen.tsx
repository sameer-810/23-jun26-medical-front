import React, { useEffect } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Phone, Mail } from "lucide-react-native";
import {
  useCustomer,
  useCreateCustomer,
  useUpdateCustomer,
} from "@modules/customer/hooks/useCustomers";
import { customerSchema } from "@modules/customer/customer.validation";
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

export default function CustomerFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string | undefined;
  const editing = Boolean(id);

  const { data: customer } = useCustomer(id || "");
  const createMut = useCreateCustomer();
  const updateMut = useUpdateCustomer(id || "");
  const mut = editing ? updateMut : createMut;

  const { control, handleSubmit, reset } = useForm({
    resolver: zodResolver(customerSchema),
    mode: "onTouched",
    defaultValues: { name: "", mobile: "", email: "", address: "", gstin: "" },
  });

  // Populate the form once the record loads (edit mode).
  useEffect(() => {
    if (customer)
      reset({
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email,
        address: customer.address,
        gstin: customer.gstin,
      });
  }, [customer, reset]);

  const submit = handleSubmit((f) =>
    mut.mutate(
      {
        name: f.name.trim(),
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
      overline="Customers"
      title={editing ? "Edit customer" : "Add customer"}
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
                label="Name"
                leading={
                  <User
                    size={18}
                    color={palette.text.tertiary}
                    strokeWidth={1.8}
                  />
                }
                placeholder="Customer name"
              />
            </View>
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
                placeholder="9876543210"
              />
            </View>
          </HStack>
          <HStack gap={12} wrap>
            <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 150 }}>
              <ControlledTextField
                control={control}
                name="email"
                label="Email (optional)"
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
            <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 150 }}>
              <ControlledTextField
                control={control}
                name="gstin"
                label="GSTIN (optional, for B2B)"
                autoCapitalize="characters"
              />
            </View>
          </HStack>
          <ControlledTextField
            control={control}
            name="address"
            label="Address (optional)"
            placeholder="Address"
          />
        </VStack>
      </Card>

      <Button
        label={editing ? "Save changes" : "Add customer"}
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
