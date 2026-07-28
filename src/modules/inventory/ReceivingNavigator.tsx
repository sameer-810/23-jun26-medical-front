import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ReceiveStockScreen from "@modules/inventory/screens/ReceiveStockScreen";
import ReceiptsScreen from "@modules/inventory/screens/ReceiptsScreen";
import ReceiptDetailScreen from "@modules/inventory/screens/ReceiptDetailScreen";
import ScanBillScreen from "@modules/inventory/screens/ScanBillScreen";
import PurchaseReturnScreen from "@modules/inventory/screens/PurchaseReturnScreen";
import type { ScannedBill } from "@modules/inventory/types";

export type ReceivingStackParamList = {
  // `scanned` arrives from the bill scanner and pre-fills the form.
  ReceiveStock: { scanned?: ScannedBill } | undefined;
  Receipts: undefined;
  ReceiptDetail: { id: string };
  ScanBill: undefined;
  PurchaseReturn: { id: string };
};

const Stack = createNativeStackNavigator<ReceivingStackParamList>();

export default function ReceivingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ReceiveStock" component={ReceiveStockScreen} />
      <Stack.Screen name="Receipts" component={ReceiptsScreen} />
      <Stack.Screen name="ReceiptDetail" component={ReceiptDetailScreen} />
      <Stack.Screen name="ScanBill" component={ScanBillScreen} />
      <Stack.Screen name="PurchaseReturn" component={PurchaseReturnScreen} />
    </Stack.Navigator>
  );
}
