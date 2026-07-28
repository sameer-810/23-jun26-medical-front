import React from "react";
import { ScrollView, Pressable, StyleSheet } from "react-native";
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
import { Text } from "@shared/ui";

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

export function AdminNav({ active }: { active: Section }) {
  const navigation = useNavigation<any>();
  const logout = useAdminStore((s) => s.logout);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={{ marginBottom: 16 }}
    >
      {ITEMS.map((it) => {
        const on = it.key === active;
        return (
          <Pressable
            key={it.key}
            onPress={() => navigation.navigate(it.route)}
            style={[styles.chip, on && styles.chipOn]}
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
      <Pressable onPress={() => logout()} style={[styles.chip, styles.signout]}>
        <LogOut size={15} color={palette.danger.text} strokeWidth={2} />
        <Text
          variant="label"
          weight="600"
          style={{ color: palette.danger.text }}
        >
          Sign out
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: palette.teal[600],
    borderColor: palette.teal[600],
  },
  signout: {
    borderColor: palette.danger.border,
    backgroundColor: palette.danger.bg,
  },
});
