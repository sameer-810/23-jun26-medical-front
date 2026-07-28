import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import OrdersScreen from "@modules/purchaseOrder/screens/OrdersScreen";
import OrderFormScreen from "@modules/purchaseOrder/screens/OrderFormScreen";
import OrderDetailScreen from "@modules/purchaseOrder/screens/OrderDetailScreen";
import type { SeededLine } from "@modules/purchaseOrder/types";

export type OrdersStackParamList = {
  OrdersList: undefined;
  OrderForm: { seedLines?: SeededLine[] } | undefined;
  OrderDetail: { id: string };
};

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export default function PurchaseOrdersNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrdersList" component={OrdersScreen} />
      <Stack.Screen name="OrderForm" component={OrderFormScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
    </Stack.Navigator>
  );
}
