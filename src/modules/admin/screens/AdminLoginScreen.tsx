import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react-native";
import { useAdminStore } from "@shared/store/useAdminStore";
import { adminApi } from "@modules/admin/api/adminApi";
import { apiErrorMessage } from "@shared/api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius } from "@shared/designSystem";
import { Text, VStack, HStack, Card, Button } from "@shared/ui";
import { adminLoginSchema } from "@modules/admin/admin.validation";

export default function AdminLoginScreen() {
  const setAuth = useAdminStore((s) => s.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit } = useForm({
    resolver: zodResolver(adminLoginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit(async (f) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const { admin, accessToken, refreshToken } = await adminApi.login(
        f.email,
        f.password,
      );
      setAuth(admin, accessToken, refreshToken);
    } catch (err) {
      setServerError(apiErrorMessage(err, "Invalid credentials"));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.center}>
        <Card>
          <VStack gap={18}>
            <HStack gap={10} align="center">
              <View style={styles.badge}>
                <ShieldCheck size={22} color="#FFFFFF" strokeWidth={2.2} />
              </View>
              <VStack gap={2}>
                <Text variant="h3" tone="primary">
                  Platform Console
                </Text>
                <Text variant="body-sm" tone="tertiary">
                  Superadmin sign in
                </Text>
              </VStack>
            </HStack>

            {serverError ? (
              <View style={styles.errorBox}>
                <Text variant="body-sm" tone="danger">
                  {serverError}
                </Text>
              </View>
            ) : null}

            <ControlledTextField
              control={control}
              name="email"
              label="Email"
              placeholder="you@medstock.app"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <ControlledTextField
              control={control}
              name="password"
              label="Password"
              placeholder="Your password"
              secureTextEntry
              autoCapitalize="none"
            />

            <Button
              label="Sign in"
              size="lg"
              loading={submitting}
              onPress={submit}
            />
          </VStack>
        </Card>
        <Text variant="caption" tone="tertiary" style={styles.footnote}>
          Restricted area — pharmacy staff use the main app.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: palette.surface.secondary,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  center: { width: "100%", maxWidth: 420 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.teal[700],
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.danger.bg,
    borderWidth: 1,
    borderColor: palette.danger.border,
  },
  footnote: { marginTop: 14, textAlign: "center" },
});
