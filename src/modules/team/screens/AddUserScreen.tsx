import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Mail, Phone, Lock } from "lucide-react-native";
import {
  useCreateUser,
  usePermissionCatalogue,
} from "@modules/team/hooks/useTeam";
import { addUserSchema } from "@modules/team/team.validation";
import { normalizePhone } from "@shared/form/fields";
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
  ChipsRow,
} from "@shared/ui";
import { PermissionEditor } from "@modules/team/components/PermissionEditor";

export default function AddUserScreen() {
  const navigation = useNavigation<any>();
  const { data: catalogue } = usePermissionCatalogue();
  const mut = useCreateUser();

  const [roleLabel, setRoleLabel] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(addUserSchema),
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
    },
  });

  const labelChips = (catalogue?.suggestedLabels || []).map((l) => ({
    key: l,
    label: l,
  }));

  const toggle = (key: string) =>
    setPermissions((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
    );

  const submit = handleSubmit((f) =>
    mut.mutate(
      {
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim() || undefined,
        email: f.email.trim(),
        // Send the normalised digits, not what was typed — the server's regex
        // has no room for the spaces and dashes people naturally write.
        phone: normalizePhone(f.phone) || undefined,
        password: f.password,
        roleLabel: roleLabel || undefined,
        permissions,
      },
      { onSuccess: () => navigation.goBack() },
    ),
  );

  return (
    <Screen
      back="Back to team"
      overline="Team"
      title="Add member"
      subtitle="Create a staff account and grant permissions"
    >
      {mut.isError && (
        <View style={errorBox}>
          <Text variant="body-sm" tone="danger">
            {apiErrorMessage(mut.error)}
          </Text>
        </View>
      )}

      <Card style={{ marginBottom: 16 }}>
        <VStack gap={16}>
          <HStack gap={12}>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="firstName"
                label="First name"
                leading={
                  <User
                    size={18}
                    color={palette.text.tertiary}
                    strokeWidth={1.8}
                  />
                }
                placeholder="Ravi"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ControlledTextField
                control={control}
                name="lastName"
                label="Last name"
                placeholder="Sharma"
              />
            </View>
          </HStack>
          <ControlledTextField
            control={control}
            name="email"
            label="Email"
            leading={
              <Mail size={18} color={palette.text.tertiary} strokeWidth={1.8} />
            }
            placeholder="ravi@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <ControlledTextField
            control={control}
            name="phone"
            label="Phone (optional)"
            leading={
              <Phone
                size={18}
                color={palette.text.tertiary}
                strokeWidth={1.8}
              />
            }
            placeholder="+91…"
            keyboardType="phone-pad"
          />
          <ControlledTextField
            control={control}
            name="password"
            label="Temporary password"
            leading={
              <Lock size={18} color={palette.text.tertiary} strokeWidth={1.8} />
            }
            placeholder="At least 6 characters"
            secureTextEntry
          />
          <View>
            <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
              Role label (display only)
            </Text>
            <ChipsRow
              chips={labelChips}
              active={roleLabel}
              onChange={setRoleLabel}
            />
          </View>
        </VStack>
      </Card>

      <Text variant="h3" tone="primary" style={{ marginBottom: 6 }}>
        Permissions
      </Text>
      <Text variant="body-sm" tone="tertiary" style={{ marginBottom: 16 }}>
        Access is controlled entirely by what you select here — the role label
        grants nothing.
      </Text>
      <Card style={{ marginBottom: 20 }}>
        <PermissionEditor
          available={catalogue?.permissions || []}
          selected={permissions}
          onToggle={toggle}
        />
      </Card>

      <Button
        label="Create member"
        onPress={submit}
        loading={mut.isPending}
        size="lg"
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
