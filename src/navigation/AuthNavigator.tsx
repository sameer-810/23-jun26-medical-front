import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "@modules/auth/screens/LoginScreen";
import SignupScreen from "@modules/auth/screens/SignupScreen";
import ForgotPasswordScreen from "@modules/auth/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "@modules/auth/screens/ResetPasswordScreen";
import PricingScreen from "@modules/pricing/screens/PricingScreen";

export type AuthStackParamList = {
  Login: undefined;
  /** `plan` is the card clicked on the public price list — `?plan=12m`. */
  Signup: { plan?: string } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { email?: string } | undefined;
  /**
   * The full price list, with the breakdown the public cards leave out.
   *
   * It lives in the AUTH stack, not the app stack, because the visitor who
   * needs it has no session: signing up creates a workspace that waits for the
   * platform team to activate it, and `pending` is what tells this screen to
   * say so.
   */
  Pricing: { plan?: string; pending?: boolean } | undefined;
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
      <Stack.Screen name="Pricing" component={PricingScreen} />
    </Stack.Navigator>
  );
}
