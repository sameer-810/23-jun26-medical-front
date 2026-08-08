import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import NewSaleScreen from "@modules/sale/screens/NewSaleScreen";
import SalesListScreen from "@modules/sale/screens/SalesListScreen";
import SaleDetailScreen from "@modules/sale/screens/SaleDetailScreen";

export type SaleStackParamList = {
  NewSale: undefined;
  SalesList: undefined;
  SaleDetail: { id: string };
};

const Stack = createNativeStackNavigator<SaleStackParamList>();

export default function SalesNavigator() {
  return (
    // Sales lands on the invoice list, not on a half-started new sale — the
    // sidebar's "Sales" and the /sales URL both mean the list. Declaration
    // order would otherwise make NewSale the stack's initial route.
    <Stack.Navigator
      initialRouteName="SalesList"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="NewSale" component={NewSaleScreen} />
      <Stack.Screen name="SalesList" component={SalesListScreen} />
      <Stack.Screen name="SaleDetail" component={SaleDetailScreen} />
    </Stack.Navigator>
  );
}
