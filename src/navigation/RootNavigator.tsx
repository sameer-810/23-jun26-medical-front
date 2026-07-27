/**
 * RootNavigator — gates between the auth stack and the app shell based on the
 * persisted session.
 */
import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "@shared/store/useAuthStore";
import { palette } from "@shared/designSystem";
import AuthNavigator from "@navigation/AuthNavigator";
import AppNavigator from "@navigation/AppNavigator";
import AdminNavigator from "@navigation/AdminNavigator";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { isAuthenticated, isHydrated, isAuthChecked } = useAuthStore();

  useEffect(() => {
    if (isHydrated) useAuthStore.getState().initializeAuth();
  }, [isHydrated]);

  if (!isHydrated || !isAuthChecked) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.surface.secondary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={palette.teal[600]} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      key={isAuthenticated ? "app-root" : "auth-root"}
      screenOptions={{ headerShown: false }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <Stack.Screen name="App" component={AppNavigator} />
      )}
      {/* Platform console — always reachable at /admin, gated by its own
          (separate) admin session regardless of the tenant auth state above. */}
      <Stack.Screen name="Admin" component={AdminNavigator} />
    </Stack.Navigator>
  );
}
