/**
 * AdminNavigator — the platform-admin (superadmin) console, mounted as a
 * top-level route (`/admin` on web). Gated by `useAdminStore`, completely
 * independent of the tenant session in `useAuthStore`: a pharmacy user reaching
 * `/admin` still sees the admin login until they authenticate as a platform
 * admin.
 */
import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAdminStore } from "@shared/store/useAdminStore";
import { palette } from "@shared/designSystem";
import AdminLoginScreen from "@modules/admin/screens/AdminLoginScreen";
import AdminDashboardScreen from "@modules/admin/screens/AdminDashboardScreen";
import PharmacyDetailScreen from "@modules/admin/screens/PharmacyDetailScreen";
import CreatePharmacyScreen from "@modules/admin/screens/CreatePharmacyScreen";

const Stack = createNativeStackNavigator();

export default function AdminNavigator() {
  const { isAuthenticated, isHydrated, isAuthChecked } = useAdminStore();

  useEffect(() => {
    if (isHydrated) useAdminStore.getState().initializeAuth();
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
      key={isAuthenticated ? "admin-in" : "admin-out"}
      screenOptions={{ headerShown: false }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
      ) : (
        <>
          <Stack.Screen
            name="AdminDashboard"
            component={AdminDashboardScreen}
          />
          <Stack.Screen
            name="AdminPharmacyDetail"
            component={PharmacyDetailScreen}
          />
          <Stack.Screen
            name="AdminCreatePharmacy"
            component={CreatePharmacyScreen}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
