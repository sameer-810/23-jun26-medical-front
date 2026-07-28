import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import InventoryScreen from "@modules/inventory/screens/InventoryScreen";
import ProductInventoryScreen from "@modules/inventory/screens/ProductInventoryScreen";
import ProductLedgerScreen from "@modules/inventory/screens/ProductLedgerScreen";
import AlternativesScreen from "@modules/inventory/screens/AlternativesScreen";

export type InventoryStackParamList = {
  InventoryList: undefined;
  ProductInventory: { id: string };
  ProductLedger: { id: string };
  Alternatives: { id: string; name?: string };
};

const Stack = createNativeStackNavigator<InventoryStackParamList>();

export default function InventoryNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InventoryList" component={InventoryScreen} />
      <Stack.Screen
        name="ProductInventory"
        component={ProductInventoryScreen}
      />
      <Stack.Screen name="ProductLedger" component={ProductLedgerScreen} />
      <Stack.Screen name="Alternatives" component={AlternativesScreen} />
    </Stack.Navigator>
  );
}
