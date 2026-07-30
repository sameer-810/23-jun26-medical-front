import React from "react";
import { View, Pressable, useWindowDimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import {
  Boxes,
  AlarmClock,
  ReceiptIndianRupee,
  Users,
  Package,
  ShoppingCart,
  PackagePlus,
  BarChart3,
  Wallet,
  BadgeIndianRupee,
  CalendarClock,
  TrendingUp,
  Landmark,
  Percent,
  ChevronRight,
  CheckCircle2,
  PackageX,
} from "lucide-react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { useDashboardSummary } from "@modules/dashboard/hooks/useDashboard";
import { dashboardApi } from "@modules/dashboard/api/dashboardApi";
import { useSectionNav } from "@navigation/AppNavigator";
import { fmtInt, fmtMoney } from "@shared/format";
import { palette, accents, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  StatTile,
  GradientHero,
  Button,
} from "@shared/ui";

const money = fmtMoney;

type AttnTone = "danger" | "warning";
interface Attn {
  key: string;
  tone: AttnTone;
  icon: typeof Boxes;
  title: string;
  hint: string;
  nav: string;
  /** Verb for the one-tap action button (act-from-widget). */
  action: string;
}

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const cols = width >= 1100 ? 4 : 2;
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const has = useAuthStore((s) => s.hasPermission);
  const go = useSectionNav();
  const navigation = useNavigation<any>();
  const { data, isLoading, refetch, isRefetching } = useDashboardSummary();
  const { data: fin } = useQuery({
    queryKey: ["dashboard", "finance"],
    queryFn: dashboardApi.finance,
  });

  const tileWidth = `${100 / cols}%` as const;

  const todayTrend = data?.sales.todayTrendPct;
  const kpis: {
    label: string;
    value: string;
    icon: typeof Package;
    accent: { color: string; tint: string };
    nav: string;
    trend?: { pct: number; good: boolean };
  }[] = [
    {
      label: "Products",
      value: fmtInt(data?.products.total),
      icon: Package,
      accent: accents.teal,
      nav: "Products",
    },
    {
      label: "Low stock",
      value: fmtInt(data?.inventory.lowStock),
      icon: Boxes,
      accent: accents.amber,
      nav: "Inventory",
    },
    {
      label: "Expiring soon",
      value: fmtInt(data?.expiry.expiringSoon),
      icon: AlarmClock,
      accent: accents.red,
      nav: "Expiry",
    },
    {
      label: "Today's sales",
      value: money(data?.sales.todayAmount ?? 0),
      icon: ReceiptIndianRupee,
      accent: accents.blue,
      nav: "Sales",
      trend:
        todayTrend != null
          ? { pct: todayTrend, good: todayTrend >= 0 }
          : undefined,
    },
  ];

  // ---- "Needs attention" — the operational board (QS/1 Pharmacy-at-a-Glance) --
  const attn: Attn[] = [];
  const lowStock = data?.inventory.lowStock ?? 0;
  const expiringSoon = data?.expiry.expiringSoon ?? 0;
  const expired = data?.expiry.expired ?? 0;
  const receivable = fin?.receivables.total ?? 0;
  const payable = fin?.needToPay.total ?? 0;
  const pdcCount = fin?.upcomingPDC.payable.count ?? 0;
  const pdcTotal = fin?.upcomingPDC.payable.total ?? 0;
  if (expired > 0)
    attn.push({
      key: "expired",
      tone: "danger",
      icon: PackageX,
      title: `${expired} expired batch${expired === 1 ? "" : "es"} to write off`,
      hint: "Remove from sellable stock",
      nav: "Expiry",
      action: "Write off",
    });
  if (expiringSoon > 0)
    attn.push({
      key: "expiring",
      tone: "warning",
      icon: AlarmClock,
      title: `${expiringSoon} batch${expiringSoon === 1 ? "" : "es"} expiring soon`,
      hint: "Sell-through or return before expiry",
      nav: "Expiry",
      action: "Review",
    });
  if (lowStock > 0)
    attn.push({
      key: "low",
      tone: "warning",
      icon: Boxes,
      title: `${lowStock} product${lowStock === 1 ? "" : "s"} low on stock`,
      hint: "Reorder to avoid stock-outs",
      nav: "ShortBook",
      action: "Reorder",
    });
  if (receivable > 0)
    attn.push({
      key: "receivable",
      tone: "warning",
      icon: Wallet,
      title: `${money(receivable)} to collect`,
      hint: "Outstanding customer credit",
      nav: "Customers",
      action: "Collect",
    });
  if (payable > 0)
    attn.push({
      key: "payable",
      tone: "warning",
      icon: BadgeIndianRupee,
      title: `${money(payable)} to pay suppliers`,
      hint: "Outstanding purchase credit",
      nav: "Suppliers",
      action: "Pay",
    });
  if (pdcCount > 0)
    attn.push({
      key: "pdc",
      tone: "warning",
      icon: CalendarClock,
      title: `${pdcCount} post-dated cheque${pdcCount === 1 ? "" : "s"} · ${money(pdcTotal)}`,
      hint: "Payable cheques coming due",
      nav: "PDC",
      action: "View",
    });

  const quickActions = [
    {
      label: "New sale",
      icon: ShoppingCart,
      perm: PERMISSIONS.SALES_MANAGE,
      onPress: () => navigation.navigate("Sales", { screen: "NewSale" }),
    },
    {
      label: "Receive stock",
      icon: PackagePlus,
      perm: PERMISSIONS.STOCK_INWARD_MANAGE,
      onPress: () => navigation.navigate("Receive", { screen: "ReceiveStock" }),
    },
    {
      label: "Add product",
      icon: Package,
      perm: PERMISSIONS.PRODUCTS_MANAGE,
      onPress: () => navigation.navigate("Products", { screen: "ProductForm" }),
    },
    {
      label: "Reports",
      icon: BarChart3,
      perm: PERMISSIONS.REPORTS_VIEW,
      onPress: () => go("Reports"),
    },
  ].filter((a) => has(a.perm));

  return (
    <Screen
      overline={greeting()}
      title={user?.firstName ? `Hello, ${user.firstName}` : "Dashboard"}
      subtitle="Your pharmacy at a glance"
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
    >
      {/* Operational hero — quick daily actions, not marketing copy. */}
      <GradientHero variant="hero">
        <VStack gap={12}>
          <Text variant="h3" tone="inverse">
            What would you like to do?
          </Text>
          <HStack gap={10} wrap>
            {quickActions.map((a) => (
              <Button
                key={a.label}
                label={a.label}
                variant="accent"
                fullWidth={false}
                icon={<a.icon size={16} color="#FFFFFF" strokeWidth={2} />}
                onPress={a.onPress}
              />
            ))}
          </HStack>
        </VStack>
      </GradientHero>

      {/* KPI bento */}
      <View style={styles.grid}>
        {kpis.map((t) => (
          <View key={t.label} style={{ width: tileWidth, padding: 6 }}>
            <StatTile
              label={t.label}
              value={t.value}
              icon={t.icon}
              accent={t.accent}
              trend={t.trend}
              hint={t.trend ? "vs yesterday" : undefined}
              onPress={() => go(t.nav)}
            />
          </View>
        ))}
      </View>

      {/* Needs attention */}
      <Text variant="h3" tone="primary" style={styles.sectionH}>
        Needs attention
      </Text>
      {attn.length === 0 ? (
        <Card>
          <HStack gap={12} align="center">
            <View
              style={[styles.attnIcon, { backgroundColor: palette.success.bg }]}
            >
              <CheckCircle2
                size={20}
                color={palette.success.text}
                strokeWidth={2}
              />
            </View>
            <VStack gap={2} flex={1}>
              <Text variant="label-lg" tone="primary">
                All clear
              </Text>
              <Text variant="body-sm" tone="tertiary">
                No low stock, expiries or dues need action right now.
              </Text>
            </VStack>
          </HStack>
        </Card>
      ) : (
        <Card padded={false} style={{ paddingVertical: 4 }}>
          {attn.map((a, i) => {
            const tone = a.tone === "danger" ? palette.danger : palette.warning;
            return (
              <View key={a.key}>
                {i > 0 ? <View style={styles.rowDivider} /> : null}
                <Pressable
                  onPress={() => go(a.nav)}
                  style={({ pressed }) => [
                    styles.attnRow,
                    pressed && { backgroundColor: palette.ink[50] },
                  ]}
                >
                  <HStack gap={12} align="center">
                    <View
                      style={[styles.attnIcon, { backgroundColor: tone.bg }]}
                    >
                      <a.icon size={18} color={tone.text} strokeWidth={2} />
                    </View>
                    <VStack gap={1} flex={1}>
                      <Text variant="label-lg" tone="primary" numberOfLines={1}>
                        {a.title}
                      </Text>
                      <Text variant="caption" tone="tertiary" numberOfLines={1}>
                        {a.hint}
                      </Text>
                    </VStack>
                    <Button
                      label={a.action}
                      size="sm"
                      variant="secondary"
                      fullWidth={false}
                      onPress={() => go(a.nav)}
                      rightIcon={
                        <ChevronRight
                          size={15}
                          color={palette.text.primary}
                          strokeWidth={2}
                        />
                      }
                    />
                  </HStack>
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}

      {/* Finance */}
      <Text variant="h3" tone="primary" style={styles.sectionH}>
        Finance
      </Text>
      <View style={[styles.grid, { marginHorizontal: -6 }]}>
        <FinTile
          w={tileWidth}
          label="Need to collect"
          value={money(fin?.receivables.total ?? 0)}
          icon={Wallet}
          accent={accents.red}
          onPress={() => go("Customers")}
        />
        <FinTile
          w={tileWidth}
          label="Need to pay"
          value={money(fin?.needToPay.total ?? 0)}
          icon={BadgeIndianRupee}
          accent={accents.amber}
          onPress={() => go("Suppliers")}
        />
        <FinTile
          w={tileWidth}
          label="Upcoming PDC (out)"
          value={money(fin?.upcomingPDC.payable.total ?? 0)}
          hint={`${fin?.upcomingPDC.payable.count ?? 0} cheque${(fin?.upcomingPDC.payable.count ?? 0) === 1 ? "" : "s"}`}
          icon={CalendarClock}
          accent={accents.blue}
          onPress={() => go("PDC")}
        />
        <FinTile
          w={tileWidth}
          label="Stock at cost (PTR)"
          value={money(fin?.stock.cost ?? 0)}
          icon={Landmark}
          accent={accents.teal}
        />
        <FinTile
          w={tileWidth}
          label="Stock at MRP"
          value={money(fin?.stock.mrp ?? 0)}
          icon={Boxes}
          accent={accents.blue}
        />
        <FinTile
          w={tileWidth}
          label="Margin (30d)"
          value={`${fin?.margin.marginPct ?? 0}%`}
          icon={Percent}
          accent={accents.amber}
        />
      </View>

      <Card style={{ marginTop: 12 }}>
        <VStack gap={12}>
          <HStack gap={8} align="center">
            <TrendingUp size={18} color={palette.teal[600]} strokeWidth={2} />
            <Text variant="label-lg" tone="primary">
              Sales &amp; purchases
            </Text>
          </HStack>
          <HStack gap={20} style={{ flexWrap: "wrap" }}>
            <Metric
              label="Sales (7d / 30d)"
              value={`${money(fin?.sales.last7 ?? 0)} / ${money(fin?.sales.last30 ?? 0)}`}
              trend={fin?.sales.trend7Pct}
            />
            <Metric
              label="Purchases (30d)"
              value={money(fin?.purchases.last30 ?? 0)}
            />
            <Metric
              label="Gross margin (30d)"
              value={`${money(fin?.margin.grossMargin ?? 0)} · ${fin?.margin.marginPct ?? 0}%`}
            />
          </HStack>
        </VStack>
      </Card>

      {fin && fin.receivables.top.length > 0 ? (
        <TopList
          title="Top receivables"
          cta="Customers"
          onCta={() => go("Customers")}
          rows={fin.receivables.top.map((c) => ({
            id: c.customerId,
            name: c.customerName,
            amount: c.outstanding,
          }))}
        />
      ) : null}
      {fin && fin.needToPay.top.length > 0 ? (
        <TopList
          title="Top payables"
          cta="Suppliers"
          onCta={() => go("Suppliers")}
          rows={fin.needToPay.top.map((s) => ({
            id: s.supplierId,
            name: s.supplierName,
            amount: s.outstanding,
          }))}
        />
      ) : null}

      {/* Team snapshot */}
      <Card style={{ marginTop: 16 }}>
        <HStack align="center" justify="space-between">
          <HStack gap={12} align="center">
            <View
              style={[styles.attnIcon, { backgroundColor: palette.teal[50] }]}
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
    </Screen>
  );
}

function FinTile({
  w,
  label,
  value,
  icon,
  accent,
  hint,
  onPress,
}: {
  w: `${number}%`;
  label: string;
  value: string;
  icon: typeof Boxes;
  accent: { color: string; tint: string };
  hint?: string;
  onPress?: () => void;
}) {
  return (
    <View style={{ width: w, padding: 6 }}>
      <StatTile
        label={label}
        value={value}
        icon={icon}
        accent={accent}
        hint={hint}
        onPress={onPress}
      />
    </View>
  );
}

function Metric({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: number | null;
}) {
  return (
    <VStack gap={1}>
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
      <HStack gap={6} align="center">
        <Text variant="label-lg" tone="primary">
          {value}
        </Text>
        {trend != null ? (
          <Text
            variant="label-sm"
            style={{
              color: trend >= 0 ? palette.success.text : palette.danger.text,
              fontWeight: "700",
            }}
          >
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
          </Text>
        ) : null}
      </HStack>
    </VStack>
  );
}

function TopList({
  title,
  cta,
  onCta,
  rows,
}: {
  title: string;
  cta: string;
  onCta: () => void;
  rows: { id: string; name: string; amount: number }[];
}) {
  return (
    <Card style={{ marginTop: 12 }}>
      <VStack gap={10}>
        <HStack justify="space-between" align="center">
          <Text variant="label-lg" tone="primary">
            {title}
          </Text>
          <Button
            label={cta}
            size="sm"
            variant="secondary"
            fullWidth={false}
            onPress={onCta}
          />
        </HStack>
        {rows.map((r) => (
          <HStack key={r.id} justify="space-between" align="center">
            <Text variant="body-sm" tone="secondary" numberOfLines={1}>
              {r.name}
            </Text>
            <Text variant="label" style={{ color: palette.danger.text }}>
              {money(r.amount)}
            </Text>
          </HStack>
        ))}
      </VStack>
    </Card>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const styles = {
  grid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    marginTop: 20,
    marginHorizontal: -6,
  },
  sectionH: { marginTop: 28, marginBottom: 12 },
  attnIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  rowDivider: {
    height: 1,
    backgroundColor: palette.border.subtle,
    marginHorizontal: 16,
  },
  attnRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
};
