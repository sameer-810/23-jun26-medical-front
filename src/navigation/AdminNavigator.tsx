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
import EditPharmacyScreen from "@modules/admin/screens/EditPharmacyScreen";
import PharmacyUsersScreen from "@modules/admin/screens/PharmacyUsersScreen";
import CatalogListScreen from "@modules/admin/screens/CatalogListScreen";
import CatalogFormScreen from "@modules/admin/screens/CatalogFormScreen";
import PlansScreen from "@modules/admin/screens/PlansScreen";
import PlanFormScreen from "@modules/admin/screens/PlanFormScreen";
import AdminsScreen from "@modules/admin/screens/AdminsScreen";
import AdminFormScreen from "@modules/admin/screens/AdminFormScreen";
import AuditScreen from "@modules/admin/screens/AuditScreen";

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
          <Stack.Screen
            name="AdminEditPharmacy"
            component={EditPharmacyScreen}
          />
          <Stack.Screen
            name="AdminPharmacyUsers"
            component={PharmacyUsersScreen}
          />
          <Stack.Screen name="AdminCatalog" component={CatalogListScreen} />
          <Stack.Screen name="AdminCatalogForm" component={CatalogFormScreen} />
          <Stack.Screen name="AdminPlans" component={PlansScreen} />
          <Stack.Screen name="AdminPlanForm" component={PlanFormScreen} />
          <Stack.Screen name="AdminAdmins" component={AdminsScreen} />
          <Stack.Screen name="AdminAdminForm" component={AdminFormScreen} />
          <Stack.Screen name="AdminAudit" component={AuditScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
