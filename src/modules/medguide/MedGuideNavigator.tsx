import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MedGuideScreen from "@modules/medguide/screens/MedGuideScreen";
import MedicineDetailScreen from "@modules/medguide/screens/MedicineDetailScreen";

export type MedGuideStackParamList = {
  MedGuideSearch: undefined;
  MedicineDetail: { id: string };
};

const Stack = createNativeStackNavigator<MedGuideStackParamList>();

export default function MedGuideNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MedGuideSearch" component={MedGuideScreen} />
      <Stack.Screen name="MedicineDetail" component={MedicineDetailScreen} />
    </Stack.Navigator>
  );
}
