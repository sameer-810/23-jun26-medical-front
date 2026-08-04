import React, { useEffect, useState } from "react";
import { View, Switch, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useForm, Controller } from "react-hook-form";
import { Trash2 } from "lucide-react-native";
import {
  useAdmins,
  useCreateAdmin,
  useUpdateAdmin,
  useRemoveAdmin,
} from "@modules/admin/hooks/useAdmin";
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
  BackLink,
} from "@shared/ui";

export default function AdminFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string | undefined;
  const editing = Boolean(id);

  const { data: admins } = useAdmins();
  const admin = admins?.find((a) => a._id === id);
  const createMut = useCreateAdmin();
  const updateMut = useUpdateAdmin();
  const removeMut = useRemoveAdmin();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { control, handleSubmit, reset } = useForm({
    defaultValues: { name: "", email: "", password: "", isActive: true },
  });

  useEffect(() => {
    if (admin)
      reset({
        name: admin.name,
        email: admin.email,
        password: "",
        isActive: admin.isActive,
      });
  }, [admin, reset]);

  const submit = handleSubmit((f) => {
    setServerError(null);
    const opts = {
      onSuccess: () => navigation.goBack(),
      onError: (err: unknown) => setServerError(apiErrorMessage(err)),
    };
    if (editing) {
      updateMut.mutate(
        {
          id: id as string,
          body: {
            name: f.name.trim(),
            isActive: f.isActive,
            ...(f.password.trim() ? { password: f.password.trim() } : {}),
          },
        },
        opts,
      );
    } else {
      createMut.mutate(
        { name: f.name.trim(), email: f.email.trim(), password: f.password },
        opts,
      );
    }
  });

  const onRemove = () => {
    if (!id) return;
    removeMut.mutate(id, {
      onSuccess: () => navigation.goBack(),
      onError: (err) => setServerError(apiErrorMessage(err)),
    });
  };

  return (
    <Screen
      overline="Platform admins"
      title={editing ? "Edit admin" : "Add admin"}
    >
      <BackLink label="Back to admins" onPress={() => navigation.goBack()} />

      {serverError ? (
        <View style={styles.errorBox}>
          <Text variant="body-sm" tone="danger">
            {serverError}
          </Text>
        </View>
      ) : null}

      <Card style={{ marginBottom: 16 }}>
        <VStack gap={16}>
          <ControlledTextField control={control} name="name" label="Name" />
          {!editing ? (
            <ControlledTextField
              control={control}
              name="email"
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          ) : null}
          <ControlledTextField
            control={control}
            name="password"
            label={editing ? "New password (leave blank to keep)" : "Password"}
            secureTextEntry
            autoCapitalize="none"
            placeholder="At least 8 characters"
          />
          {editing ? (
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <HStack gap={12} align="center" justify="space-between">
                  <Text variant="body" tone="secondary">
                    Active
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
          ) : null}
        </VStack>
      </Card>

      <Button
        label={editing ? "Save changes" : "Add admin"}
        size="lg"
        loading={createMut.isPending || updateMut.isPending}
        onPress={submit}
      />

      {editing ? (
        <Button
          label="Remove admin"
          variant="destructive"
          icon={<Trash2 size={16} color="#FFFFFF" strokeWidth={2} />}
          style={{ marginTop: 16 }}
          loading={removeMut.isPending}
          onPress={() => setConfirmOpen(true)}
        />
      ) : null}

      <ConfirmDialog
        visible={confirmOpen}
        title="Remove this platform admin?"
        confirmLabel="Remove"
        destructive
        loading={removeMut.isPending}
        onConfirm={onRemove}
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
