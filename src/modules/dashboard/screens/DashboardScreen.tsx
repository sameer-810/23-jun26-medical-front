import React from "react";
import { View, useWindowDimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
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
  Wallet,
  TrendingUp,
  Landmark,
  Percent,
} from "lucide-react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import { useDashboardSummary } from "@modules/dashboard/hooks/useDashboard";
import { dashboardApi } from "@modules/dashboard/api/dashboardApi";
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
  const { data: fin } = useQuery({
    queryKey: ["dashboard", "finance"],
    queryFn: dashboardApi.finance,
  });
  const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

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

      {/* Finance */}
      <Text
        variant="h3"
        tone="primary"
        style={{ marginTop: 28, marginBottom: 12 }}
      >
        Finance
      </Text>
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}
      >
        <View style={{ width: tileWidth, padding: 6 }}>
          <StatTile
            label="Need to collect"
            value={money(fin?.receivables.total ?? 0)}
            icon={Wallet}
            accent={accents.red}
          />
        </View>
        <View style={{ width: tileWidth, padding: 6 }}>
          <StatTile
            label="Stock at cost (PTR)"
            value={money(fin?.stock.cost ?? 0)}
            icon={Landmark}
            accent={accents.teal}
          />
        </View>
        <View style={{ width: tileWidth, padding: 6 }}>
          <StatTile
            label="Stock at MRP"
            value={money(fin?.stock.mrp ?? 0)}
            icon={Boxes}
            accent={accents.blue}
          />
        </View>
        <View style={{ width: tileWidth, padding: 6 }}>
          <StatTile
            label="Margin (30d)"
            value={`${fin?.margin.marginPct ?? 0}%`}
            icon={Percent}
            accent={accents.amber}
          />
        </View>
      </View>

      <Card style={{ marginTop: 12 }}>
        <VStack gap={12}>
          <HStack justify="space-between" align="center">
            <HStack gap={8} align="center">
              <TrendingUp size={18} color={palette.teal[600]} strokeWidth={2} />
              <Text variant="label-lg" tone="primary">
                Sales &amp; purchases
              </Text>
            </HStack>
          </HStack>
          <HStack gap={16} style={{ flexWrap: "wrap" }}>
            <VStack gap={1}>
              <Text variant="caption" tone="tertiary">
                Sales (7d / 30d)
              </Text>
              <Text variant="body-sm" tone="secondary">
                {money(fin?.sales.last7 ?? 0)} / {money(fin?.sales.last30 ?? 0)}
              </Text>
            </VStack>
            <VStack gap={1}>
              <Text variant="caption" tone="tertiary">
                Purchases (30d)
              </Text>
              <Text variant="body-sm" tone="secondary">
                {money(fin?.purchases.last30 ?? 0)}
              </Text>
            </VStack>
            <VStack gap={1}>
              <Text variant="caption" tone="tertiary">
                Gross margin (30d)
              </Text>
              <Text variant="body-sm" tone="secondary">
                {money(fin?.margin.grossMargin ?? 0)} (
                {fin?.margin.marginPct ?? 0}
                %)
              </Text>
            </VStack>
          </HStack>
        </VStack>
      </Card>

      {fin && fin.receivables.top.length > 0 ? (
        <Card style={{ marginTop: 12 }}>
          <VStack gap={10}>
            <HStack justify="space-between" align="center">
              <Text variant="label-lg" tone="primary">
                Need to collect
              </Text>
              <Button
                label="Customers"
                size="sm"
                variant="secondary"
                fullWidth={false}
                onPress={() => go("Customers")}
              />
            </HStack>
            {fin.receivables.top.map((c) => (
              <HStack key={c.customerId} justify="space-between" align="center">
                <Text variant="body-sm" tone="secondary" numberOfLines={1}>
                  {c.customerName}
                </Text>
                <Text
                  variant="label"
                  weight="600"
                  style={{ color: palette.danger.text }}
                >
                  {money(c.outstanding)}
                </Text>
              </HStack>
            ))}
          </VStack>
        </Card>
      ) : null}

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
