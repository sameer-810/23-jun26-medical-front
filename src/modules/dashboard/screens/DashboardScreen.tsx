import React from "react";
import { View, useWindowDimensions } from "react-native";
import {
  Boxes,
  PackageSearch,
  AlarmClock,
  ReceiptIndianRupee,
  Users,
  Package,
  Warehouse,
  ArrowLeftRight,
  ShoppingCart,
  ShieldAlert,
  Truck,
  BarChart3,
} from "lucide-react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import { useDashboardSummary } from "@modules/dashboard/hooks/useDashboard";
import { useSectionNav } from "@navigation/AppNavigator";
import { palette, accents } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  StatTile,
  GradientHero,
  StatusChip,
  Button,
} from "@shared/ui";

const MODULES: {
  icon: typeof Package;
  label: string;
  phase: number;
  nav?: string;
}[] = [
  { icon: Package, label: "Products & Catalogue", phase: 2, nav: "Products" },
  { icon: Warehouse, label: "Warehouse Locations", phase: 2, nav: "Warehouse" },
  { icon: Boxes, label: "Inventory & Stock Value", phase: 3, nav: "Inventory" },
  {
    icon: PackageSearch,
    label: "Receive Stock & Batches",
    phase: 3,
    nav: "Receive",
  },
  {
    icon: ShoppingCart,
    label: "Sales · FEFO · Invoices",
    phase: 4,
    nav: "Sales",
  },
  { icon: Users, label: "Customers", phase: 4, nav: "Customers" },
  {
    icon: ArrowLeftRight,
    label: "Stock Transfers",
    phase: 5,
    nav: "Transfers",
  },
  { icon: AlarmClock, label: "Expiry Alerts", phase: 5, nav: "Expiry" },
  { icon: ShieldAlert, label: "Damaged Inventory", phase: 5, nav: "Damaged" },
  { icon: Truck, label: "Suppliers & Purchases", phase: 5, nav: "Suppliers" },
  { icon: BarChart3, label: "Reports & Exports", phase: 6, nav: "Reports" },
];

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const cols = width >= 1100 ? 4 : width >= 700 ? 2 : 2;
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const go = useSectionNav();
  const { data, isLoading, refetch, isRefetching } = useDashboardSummary();

  const tiles = [
    {
      label: "Products",
      value: String(data?.products.total ?? 0),
      icon: Package,
      accent: accents.teal,
    },
    {
      label: "Low stock",
      value: String(data?.inventory.lowStock ?? 0),
      icon: Boxes,
      accent: accents.amber,
    },
    {
      label: "Expiring soon",
      value: String(data?.expiry.expiringSoon ?? 0),
      icon: AlarmClock,
      accent: accents.red,
    },
    {
      label: "Today's sales",
      value: `₹${data?.sales.todayAmount ?? 0}`,
      icon: ReceiptIndianRupee,
      accent: accents.blue,
    },
  ];
  const tileWidth = `${100 / cols}%` as const;

  return (
    <Screen
      overline={greeting()}
      title={user?.firstName ? `Hello, ${user.firstName}` : "Dashboard"}
      subtitle="Your inventory at a glance"
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
    >
      <GradientHero variant="hero">
        <VStack gap={10}>
          <StatusChip
            label="All modules live · reports & exports ready"
            tone="success"
          />
          <Text variant="h2" tone="inverse">
            Welcome to Plusveda
          </Text>
          <Text variant="body" style={{ color: "rgba(255,255,255,0.86)" }}>
            Products, warehouse, inventory, sales with FEFO & GST, expiry,
            transfers, suppliers and reporting — your full medical inventory
            platform.
          </Text>
          {isAdmin() && (
            <HStack gap={10} style={{ marginTop: 8 }} wrap>
              <Button
                label="Invite a teammate"
                variant="accent"
                fullWidth={false}
                onPress={() => go("Team")}
              />
              <Button
                label="Company settings"
                variant="secondary"
                fullWidth={false}
                onPress={() => go("Settings")}
              />
            </HStack>
          )}
        </VStack>
      </GradientHero>

      {/* KPI bento */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          marginTop: 20,
          marginHorizontal: -6,
        }}
      >
        {tiles.map((t) => (
          <View key={t.label} style={{ width: tileWidth, padding: 6 }}>
            <StatTile
              label={t.label}
              value={t.value}
              icon={t.icon}
              accent={t.accent}
            />
          </View>
        ))}
      </View>

      {/* Team snapshot */}
      <Card style={{ marginTop: 16 }}>
        <HStack align="center" justify="space-between">
          <HStack gap={12} align="center">
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: palette.teal[50],
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={20} color={palette.teal[600]} strokeWidth={2} />
            </View>
            <VStack gap={2}>
              <Text variant="h3" tone="primary">
                {data?.team.active ?? 0} active · {data?.team.total ?? 0} total
              </Text>
              <Text variant="body-sm" tone="tertiary">
                Team members in your workspace
              </Text>
            </VStack>
          </HStack>
          {isAdmin() && (
            <Button
              label="Manage"
              variant="secondary"
              fullWidth={false}
              onPress={() => go("Team")}
            />
          )}
        </HStack>
      </Card>

      {/* Module roadmap */}
      <Text
        variant="h3"
        tone="primary"
        style={{ marginTop: 28, marginBottom: 12 }}
      >
        Modules
      </Text>
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}
      >
        {MODULES.map((m) => {
          const live = Boolean(m.nav);
          return (
            <View
              key={m.label}
              style={{
                width: cols >= 4 ? "33.33%" : width >= 700 ? "50%" : "100%",
                padding: 6,
              }}
            >
              <Card padded onPress={live ? () => go(m.nav!) : undefined}>
                <HStack gap={12} align="center">
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: live
                        ? palette.teal[50]
                        : palette.ink[50],
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <m.icon
                      size={18}
                      color={live ? palette.teal[600] : palette.ink[500]}
                      strokeWidth={1.9}
                    />
                  </View>
                  <VStack gap={3} flex={1}>
                    <Text variant="label-lg" tone="primary" numberOfLines={1}>
                      {m.label}
                    </Text>
                    <StatusChip
                      label={live ? "Live" : `Phase ${m.phase}`}
                      tone={live ? "success" : "neutral"}
                    />
                  </VStack>
                </HStack>
              </Card>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
