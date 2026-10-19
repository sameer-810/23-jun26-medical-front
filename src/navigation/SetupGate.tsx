/**
 * Holds the app shut until the shop's required details are filled in — the
 * client's rule: "no option should be accessible until the required fields in
 * Settings are filled". Admins get only the Settings screen; staff, who cannot
 * edit settings, get told who can.
 *
 * Fails open: while the check is loading, offline or erroring, nothing is
 * locked. A pharmacy must never lose its till to a network blip.
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Settings2 } from "lucide-react-native";
import SettingsScreen from "@modules/settings/screens/SettingsScreen";
import { useSetupStatus } from "@modules/settings/hooks/useSettings";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { palette } from "@shared/designSystem";
import { Text, VStack, HStack, Button, Card } from "@shared/ui";

const Stack = createNativeStackNavigator();

export function SetupGate({ children }: { children: React.ReactNode }) {
  const signedIn = useAuthStore((s) => Boolean(s.token));
  const canEdit = useAuthStore((s) => s.hasPermission)(
    PERMISSIONS.SETTINGS_MANAGE,
  );
  const logout = useAuthStore((s) => s.logout);
  const { data, refetch, isFetching } = useSetupStatus(signedIn);

  if (!data || data.complete) return <>{children}</>;

  if (canEdit)
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    );

  return (
    <View style={styles.wrap}>
      <Card style={{ maxWidth: 440, width: "100%" }}>
        <VStack gap={12}>
          <HStack gap={10} align="center">
            <Settings2 size={20} color={palette.warning.text} strokeWidth={2} />
            <Text variant="h4" tone="primary">
              Shop setup isn&apos;t finished
            </Text>
          </HStack>
          <Text variant="body-sm" tone="secondary">
            Your admin needs to fill in the shop details in Settings before
            Plusveda can be used. Still needed: {data.missing.join(", ")}.
          </Text>
          <HStack gap={10} wrap>
            <Button
              label="Check again"
              size="sm"
              fullWidth={false}
              loading={isFetching}
              onPress={() => void refetch()}
            />
            <Button
              label="Sign out"
              size="sm"
              variant="secondary"
              fullWidth={false}
              onPress={() => void logout()}
            />
          </HStack>
        </VStack>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: palette.surface.secondary,
  },
});
