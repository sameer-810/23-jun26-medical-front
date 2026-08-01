import React from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Building2,
  Pill,
  CreditCard,
  ShieldCheck,
  ScrollText,
  LogOut,
} from "lucide-react-native";
import { useAdminStore } from "@shared/store/useAdminStore";
import { palette, radius } from "@shared/designSystem";
import { Text, VStack, HStack } from "@shared/ui";

type Section = "pharmacies" | "catalog" | "plans" | "admins" | "audit";

const ITEMS: {
  key: Section;
  label: string;
  icon: typeof Building2;
  route: string;
}[] = [
  {
    key: "pharmacies",
    label: "Pharmacies",
    icon: Building2,
    route: "AdminDashboard",
  },
  { key: "catalog", label: "Catalogue", icon: Pill, route: "AdminCatalog" },
  { key: "plans", label: "Plans", icon: CreditCard, route: "AdminPlans" },
  { key: "admins", label: "Admins", icon: ShieldCheck, route: "AdminAdmins" },
  { key: "audit", label: "Audit", icon: ScrollText, route: "AdminAudit" },
];

/**
 * AdminNav — the platform (superadmin) console header. Reconciled into the
 * tenant design language: same tokens and tab treatment as the app sidebar, but
 * a distinct cobalt "control plane" identity + a Platform badge so a superadmin
 * always knows they're outside a single pharmacy's data.
 */
export function AdminNav({ active }: { active: Section }) {
  const navigation = useNavigation<any>();
  const logout = useAdminStore((s) => s.logout);
  return (
    <VStack gap={14} style={{ marginBottom: 16 }}>
      {/* Console identity */}
      <HStack gap={12} align="center">
        <View style={styles.logo}>
          <ShieldCheck size={20} color="#FFFFFF" strokeWidth={2.2} />
        </View>
        <VStack gap={1} flex={1}>
          <HStack gap={8} align="center">
            <Text variant="h4" tone="primary">
              Plusveda
            </Text>
            <View style={styles.badge}>
              <Text variant="label-sm" style={{ color: palette.cobalt[700] }}>
                PLATFORM CONSOLE
              </Text>
            </View>
          </HStack>
          <Text variant="caption" tone="tertiary">
            Manage every pharmacy, the global catalogue, plans and admins
          </Text>
        </VStack>
        <Pressable
          onPress={() => logout()}
          style={[styles.chip, styles.signout]}
          accessibilityRole="button"
          accessibilityLabel="Sign out of the platform console"
        >
          <LogOut size={15} color={palette.danger.text} strokeWidth={2} />
          <Text
            variant="label"
            weight="600"
            style={{ color: palette.danger.text }}
          >
            Sign out
          </Text>
        </Pressable>
      </HStack>

      {/* Section tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {ITEMS.map((it) => {
          const on = it.key === active;
          return (
            <Pressable
              key={it.key}
              onPress={() => navigation.navigate(it.route)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={it.label}
            >
              <it.icon
                size={15}
                color={on ? "#FFFFFF" : palette.text.secondary}
                strokeWidth={2}
              />
              <Text
                variant="label"
                weight="600"
                style={{ color: on ? "#FFFFFF" : palette.text.secondary }}
              >
                {it.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </VStack>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: palette.cobalt[600],
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: palette.cobalt[50],
    borderWidth: 1,
    borderColor: palette.cobalt[200],
  },
  row: { gap: 8, paddingRight: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.full,
    backgroundColor: palette.surface.primary,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  chipOn: {
    backgroundColor: palette.teal[700],
    borderColor: palette.teal[700],
  },
  signout: {
    borderColor: palette.danger.border,
    backgroundColor: palette.danger.bg,
  },
});
