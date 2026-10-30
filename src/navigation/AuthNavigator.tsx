import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "@modules/auth/screens/LoginScreen";
import { SHOW_PRICES } from "@shared/storePolicy";
import {
  ForgotPasswordScreen,
  PricingScreen,
  ResetPasswordScreen,
  SignupScreen,
} from "./lazyScreens";

export type AuthStackParamList = {
  Login: undefined;
  /** `plan` is the card clicked on the public price list — `?plan=12m`. */
  Signup: { plan?: string } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { email?: string } | undefined;
  /**
   * The full price list, with the breakdown the public cards leave out.
   * In the AUTH stack for the visitor whose trial has ended and who can no
   * longer sign in; the app registers its own copy ("Plans") for trial users.
   */
  Pricing: { plan?: string; trialEnded?: boolean } | undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="Login"
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      {/* Not on iOS — see storePolicy.ts. */}
      {SHOW_PRICES && <Stack.Screen name="Pricing" component={PricingScreen} />}
    </Stack.Navigator>
  );
}
