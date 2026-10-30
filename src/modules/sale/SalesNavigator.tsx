import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { lazyScreen } from "@navigation/lazyScreen";
// The till and its offline queue stay in the main bundle: billing must never
// wait on a chunk, least of all during an outage.
import NewSaleScreen from "@modules/sale/screens/NewSaleScreen";
import OfflineSyncScreen from "@modules/sale/screens/OfflineSyncScreen";

const SalesListScreen = lazyScreen(
  () => import("@modules/sale/screens/SalesListScreen"),
);
const SaleDetailScreen = lazyScreen(
  () => import("@modules/sale/screens/SaleDetailScreen"),
);
const RxRegisterScreen = lazyScreen(
  () => import("@modules/sale/screens/RxRegisterScreen"),
);

export type SaleStackParamList = {
  NewSale: undefined;
  SalesList: undefined;
  SaleDetail: { id: string };
  OfflineSync: undefined;
  RxRegister: undefined;
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
      <Stack.Screen name="RxRegister" component={RxRegisterScreen} />
    </Stack.Navigator>
  );
}
