import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import NewSaleScreen from "@modules/sale/screens/NewSaleScreen";
import SalesListScreen from "@modules/sale/screens/SalesListScreen";
import SaleDetailScreen from "@modules/sale/screens/SaleDetailScreen";
import OfflineSyncScreen from "@modules/sale/screens/OfflineSyncScreen";

export type SaleStackParamList = {
  NewSale: undefined;
  SalesList: undefined;
  SaleDetail: { id: string };
  OfflineSync: undefined;
};

const Stack = createNativeStackNavigator<SaleStackParamList>();

export default function SalesNavigator() {
  return (
    // Sales lands on the till, not the invoice list. Billing is the job a
    // pharmacist opens this section to do — a hundred times a day — while the
    // invoice list is something they look at occasionally, and it is one tap
    // away on the "Invoices" button. Stated explicitly rather than relying on
    // declaration order.
    <Stack.Navigator
      initialRouteName="NewSale"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="NewSale" component={NewSaleScreen} />
      <Stack.Screen name="SalesList" component={SalesListScreen} />
      <Stack.Screen name="SaleDetail" component={SaleDetailScreen} />
      <Stack.Screen name="OfflineSync" component={OfflineSyncScreen} />
    </Stack.Navigator>
  );
}
