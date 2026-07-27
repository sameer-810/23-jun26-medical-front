import React from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Activity, ShieldCheck, Boxes, TrendingUp } from "lucide-react-native";
import { palette, gradients, radius, layout } from "@shared/designSystem";
import { Text, VStack, HStack } from "@shared/ui";

interface Props {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

const HIGHLIGHTS = [
  { icon: Boxes, text: "Batch & location-level stock tracking" },
  { icon: ShieldCheck, text: "FEFO dispensing, never sell expired" },
  { icon: TrendingUp, text: "GST invoices, returns & live reports" },
];

/** Split auth layout — branded gradient panel on wide screens, form on the right. */
export function AuthLayout({ title, subtitle, children }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= layout.wideBreakpoint;

  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        backgroundColor: palette.surface.secondary,
      }}
    >
      {isWide && (
        <LinearGradient
          colors={[...gradients.hero] as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandPanel}
        >
          <SafeAreaView
            style={{ flex: 1, justifyContent: "space-between", padding: 48 }}
          >
            <HStack gap={12} align="center">
              <View style={styles.logo}>
                <Activity size={24} color="#FFFFFF" strokeWidth={2.4} />
              </View>
              <Text variant="h2" tone="inverse">
                Plusveda
              </Text>
            </HStack>

            <VStack gap={18}>
              <Text variant="display-sm" tone="inverse">
                Medical inventory,{"\n"}warehouse & sales — in one place.
              </Text>
              <VStack gap={14} style={{ marginTop: 12 }}>
                {HIGHLIGHTS.map((h) => (
                  <HStack key={h.text} gap={12} align="center">
                    <View style={styles.hIcon}>
                      <h.icon size={18} color="#FFFFFF" strokeWidth={2} />
                    </View>
                    <Text
                      variant="body"
                      style={{ color: "rgba(255,255,255,0.92)" }}
                    >
                      {h.text}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </VStack>

            <Text variant="caption" style={{ color: "rgba(255,255,255,0.6)" }}>
              Multi-tenant SaaS · Permission-based access · Tamper-proof audit
            </Text>
          </SafeAreaView>
        </LinearGradient>
      )}

      <View style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={styles.formScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formInner}>
                {!isWide && (
                  <HStack gap={10} align="center" style={{ marginBottom: 28 }}>
                    <View
                      style={[
                        styles.logo,
                        { backgroundColor: palette.teal[600] },
                      ]}
                    >
                      <Activity size={20} color="#FFFFFF" strokeWidth={2.4} />
                    </View>
                    <Text variant="h3" tone="primary">
                      Plusveda
                    </Text>
                  </HStack>
                )}
                <VStack gap={6} style={{ marginBottom: 24 }}>
                  <Text variant="h1" tone="primary">
                    {title}
                  </Text>
                  <Text variant="body" tone="tertiary">
                    {subtitle}
                  </Text>
                </VStack>
                {children}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandPanel: { flex: 1, maxWidth: 520 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  hIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  formScroll: { flexGrow: 1, justifyContent: "center", padding: 28 },
  formInner: { width: "100%", maxWidth: 420, alignSelf: "center" },
});
