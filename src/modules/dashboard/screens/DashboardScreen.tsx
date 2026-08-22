import React from "react";
import { View, useWindowDimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import {
  Boxes,
  AlarmClock,
  Users,
  Package,
  ShoppingCart,
  PackagePlus,
  BarChart3,
  Wallet,
  BadgeIndianRupee,
  CalendarClock,
  CheckCircle2,
  PackageX,
} from "lucide-react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { useDashboardSummary } from "@modules/dashboard/hooks/useDashboard";
import { dashboardApi } from "@modules/dashboard/api/dashboardApi";
import { useSectionNav } from "@navigation/AppNavigator";
import { fmtInt, fmtMoney } from "@shared/format";
import { ScanFab } from "@navigation/ScanFab";
import { palette, accents, layout } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  StatRow,
  TrendChart,
  SectionHeader,
  Button,
  ErrorState,
  ListRow,
  ListGroup,
} from "@shared/ui";
import type { Stat } from "@shared/ui";

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

/**
 * Dashboard.
 *
 * REDESIGN NOTE — this screen carried most of the "looks like juniors made it"
 * verdict, and it is worth recording what was actually wrong, because the fixes
 * are not cosmetic:
 *
 *  - A gradient green→blue banner headed "What would you like to do?" with four
 *    filled blue buttons opened the page. It was the loudest object on screen
 *    and it held four links. The sidebar already lists every one of them.
 *  - Ten metrics rendered as ten separate 104px cards, each with a coloured cap
 *    and a tinted icon bubble, in five different accent colours.
 *  - "GOOD EVENING / Hello, plusveda / Your pharmacy at a glance" spent roughly
 *    a fifth of a phone screen greeting someone who opens this app forty times
 *    a day to check what needs doing.
 *
 * What replaces it: the four headline figures in one hairline-divided panel,
 * quick actions as a plain toolbar beside the title, and "Needs attention" —
 * the only part of the old page that was doing real work — promoted to the top
 * of the content. Finance detail sits below it for the person who scrolls.
 */
export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= layout.wideBreakpoint;
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const has = useAuthStore((s) => s.hasPermission);
  const go = useSectionNav();
  const navigation = useNavigation<any>();
  const {
    data,
    isLoading,
    isError: sumError,
    error: sumErr,
    refetch,
    isRefetching,
  } = useDashboardSummary();
  const {
    data: fin,
    isError: finError,
    error: finErr,
    isLoading: finLoading,
    isRefetching: finRefetching,
    refetch: refetchFin,
  } = useQuery({
    queryKey: ["dashboard", "finance"],
    queryFn: dashboardApi.finance,
  });

  // The page is fed by two independent queries; refresh has to cover both.
  const refreshAll = () => {
    refetch();
    refetchFin();
  };

  // Zero is a real figure on these tiles, so a query that didn't load renders "—".
  const finMissing = finError || (!fin && !finLoading);
  const fmtFin = (value: number | undefined, format: (n: number) => string) =>
    finMissing ? "—" : format(value ?? 0);

  const sumMissing = sumError || (!data && !isLoading);
  const fmtSum = (value: number | undefined, format: (n: number) => string) =>
    sumMissing ? "—" : format(value ?? 0);

  const todayTrend = data?.sales.todayTrendPct;
  const lowStock = data?.inventory.lowStock ?? 0;
  const expiringSoon = data?.expiry.expiringSoon ?? 0;

  /**
   * The four figures worth the top of the page.
   *
   * Only the two that can be *bad* carry a colour — a stock count is not an
   * alarm, so "Products" gets no accent. That restraint is the difference
   * between a dashboard and a box of highlighters.
   */
  const kpis: Stat[] = [
    {
      label: "Today's sales",
      value: fmtSum(data?.sales.todayAmount, money),
      hint: todayTrend != null ? "vs yesterday" : undefined,
      trend:
        todayTrend != null
          ? { pct: todayTrend, good: todayTrend >= 0 }
          : undefined,
      onPress: () => go("Sales"),
    },
    {
      label: "Products",
      value: sumMissing ? "—" : fmtInt(data?.products.total),
      onPress: () => go("Products"),
    },
    {
      label: "Low stock",
      value: sumMissing ? "—" : fmtInt(lowStock),
      accent: !sumMissing && lowStock > 0 ? accents.amber : undefined,
      onPress: () => go("Inventory"),
    },
    {
      label: "Expiring soon",
      value: sumMissing ? "—" : fmtInt(expiringSoon),
      accent: !sumMissing && expiringSoon > 0 ? accents.red : undefined,
      onPress: () => go("Expiry"),
    },
  ];

  // ---- "Needs attention" — the operational board (QS/1 Pharmacy-at-a-Glance) --
  const attn: Attn[] = [];
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
      // The expiry screen only lists lots; the write-off tool is Damaged, which
      // carries an "Expired" reason. A row named for an action has to reach the
      // control that performs it.
      nav: "Damaged",
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

  /**
   * `inTabBar` marks the actions the phone's bottom bar already reaches in one
   * tap. Repeating "New sale" and "Receive stock" as buttons directly above a
   * nav bar carrying Sell and Receive is the same link twice on one screen —
   * it costs a third of the fold and teaches nobody where the app lives. On a
   * desktop, where there is no tab bar, all four stay.
   */
  const quickActions = [
    {
      label: "New sale",
      icon: ShoppingCart,
      perm: PERMISSIONS.SALES_MANAGE,
      primary: true,
      inTabBar: true,
      onPress: () => navigation.navigate("Sales", { screen: "NewSale" }),
    },
    {
      label: "Receive stock",
      icon: PackagePlus,
      perm: PERMISSIONS.STOCK_INWARD_MANAGE,
      inTabBar: true,
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
  ].filter((a) => has(a.perm) && (wide || !a.inTabBar));

  /**
   * Quick actions as a toolbar, not a hero.
   *
   * One filled button (Mercury's rule: a single primary action per view); the
   * rest are outlined. On a phone they sit under the title in a wrapping row
   * rather than as four stacked full-width bars.
   */
  const actionBar =
    quickActions.length || !wide ? (
      <HStack gap={8} wrap align="center">
        {/* Phone only: the fastest path to a sale, and the product's whole
          pitch. On desktop there is a barcode gun and a sidebar. */}
        {!wide ? <ScanFab /> : null}
        {quickActions.map((a) => (
          <Button
            key={a.label}
            label={a.label}
            variant={a.primary ? "primary" : "secondary"}
            size={wide ? "sm" : "xs"}
            fullWidth={false}
            icon={
              <a.icon
                size={14}
                color={a.primary ? "#FFFFFF" : palette.text.secondary}
                strokeWidth={2}
              />
            }
            onPress={a.onPress}
          />
        ))}
      </HStack>
    ) : null;

  return (
    <Screen
      title={user?.firstName ? `Hello, ${user.firstName}` : "Dashboard"}
      right={wide ? actionBar : undefined}
      refreshing={isRefetching || isLoading || finRefetching}
      onRefresh={refreshAll}
    >
      {/* On a phone the actions get their own line under the title. */}
      {!wide && actionBar ? (
        <View style={{ marginBottom: 12 }}>{actionBar}</View>
      ) : null}

      {/* Names the failure above the tiles, so the dashes below have an explanation. */}
      {sumMissing ? (
        <ErrorState
          error={sumErr}
          title="Couldn't load today's figures"
          onRetry={refreshAll}
          // Retry refetches both queries, so the spinner tracks both.
          retrying={isRefetching || finRefetching}
          style={{ marginBottom: 10 }}
        />
      ) : null}

      {/* Headline figures — one panel, hairline-divided. */}
      <StatRow stats={kpis} />

      {/*
        The trend chart, when the backend supplies the series.

        Guarded rather than assumed: `daily` was added to /dashboard/finance
        after this app shipped, so against an older deployment the dashboard
        simply renders without a chart instead of erroring.
      */}
      {fin?.sales.daily?.length ? (
        <TrendChart
          title="Daily sales"
          subtitle="Last 30 days · gross, before returns"
          format={money}
          data={fin.sales.daily}
          height={wide ? 132 : 104}
          style={{ marginTop: 10 }}
        />
      ) : null}

      {/* Needs attention — the reason this page exists. */}
      <SectionHeader title="Needs attention" />
      {/* The all-clear is drawn from both queries, so it needs both to have loaded. */}
      {attn.length === 0 && (sumMissing || finMissing) ? (
        <ErrorState
          error={sumMissing ? sumErr : finErr}
          title="Couldn't check what needs attention"
          message="This is not an all-clear — the figures behind it didn't load. Try again to see what's outstanding."
          onRetry={refreshAll}
          retrying={isRefetching || finRefetching}
        />
      ) : attn.length === 0 ? (
        <Card>
          <HStack gap={10} align="center">
            <CheckCircle2
              size={16}
              color={palette.success.text}
              strokeWidth={2}
            />
            <VStack gap={1} flex={1}>
              <Text variant="label" tone="primary">
                All clear
              </Text>
              <Text variant="body-sm" tone="tertiary">
                No low stock, expiries or dues need action right now.
              </Text>
            </VStack>
          </HStack>
        </Card>
      ) : (
        <ListGroup>
          {attn.map((a) => {
            const tone = a.tone === "danger" ? palette.danger : palette.warning;
            return (
              <ListRow
                key={a.key}
                icon={a.icon}
                accent={{ color: tone.text, tint: tone.bg }}
                title={a.title}
                subtitle={a.hint}
                onPress={() => go(a.nav)}
                chevron={false}
                right={
                  <Button
                    label={a.action}
                    size="xs"
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => go(a.nav)}
                  />
                }
              />
            );
          })}
        </ListGroup>
      )}

      {/* Finance */}
      <SectionHeader title="Finance" />
      {finMissing ? (
        <ErrorState
          error={finErr}
          title="Couldn't load your finance figures"
          message="These totals are not zero — they haven't loaded. Check your connection and try again."
          onRetry={() => refetchFin()}
          retrying={finRefetching}
          style={{ marginBottom: 10 }}
        />
      ) : null}

      <StatRow
        columns={wide ? 3 : 2}
        stats={[
          {
            label: "Need to collect",
            value: fmtFin(fin?.receivables.total, money),
            accent: receivable > 0 ? accents.red : undefined,
            onPress: () => go("Customers"),
          },
          {
            label: "Need to pay",
            value: fmtFin(fin?.needToPay.total, money),
            accent: payable > 0 ? accents.amber : undefined,
            onPress: () => go("Suppliers"),
          },
          {
            label: "Upcoming PDC (out)",
            value: fmtFin(fin?.upcomingPDC.payable.total, money),
            hint: `${pdcCount} cheque${pdcCount === 1 ? "" : "s"}`,
            onPress: () => go("PDC"),
          },
          {
            label: "Stock at cost (PTR)",
            value: fmtFin(fin?.stock.cost, money),
          },
          {
            label: "Stock at MRP",
            value: fmtFin(fin?.stock.mrp, money),
          },
          {
            label: "Margin (30d)",
            value: fmtFin(fin?.margin.marginPct, (n) => `${n}%`),
          },
        ]}
      />

      {/* Sales & purchases — a small ledger, not a card of chips. */}
      <SectionHeader title="Sales & purchases" />

      <ListGroup>
        <ListRow
          title="Sales"
          subtitle="Last 7 days / 30 days"
          value={
            finMissing
              ? "—"
              : `${money(fin?.sales.last7 ?? 0)} / ${money(fin?.sales.last30 ?? 0)}`
          }
          right={
            fin?.sales.trend7Pct != null ? (
              <Text
                variant="label-sm"
                style={{
                  color:
                    fin.sales.trend7Pct >= 0
                      ? palette.success.text
                      : palette.danger.text,
                }}
              >
                {fin.sales.trend7Pct >= 0 ? "↑" : "↓"}{" "}
                {Math.abs(fin.sales.trend7Pct)}%
              </Text>
            ) : undefined
          }
        />
        <ListRow
          title="Purchases"
          subtitle="Last 30 days"
          value={fmtFin(fin?.purchases.last30, money)}
        />
        <ListRow
          title="Gross margin"
          subtitle="Last 30 days"
          value={
            finMissing
              ? "—"
              : `${money(fin?.margin.grossMargin ?? 0)} · ${fin?.margin.marginPct ?? 0}%`
          }
        />
      </ListGroup>

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
      <SectionHeader
        title="Team"
        action={
          isAdmin() ? (
            <Button
              label="Manage"
              variant="secondary"
              size="xs"
              fullWidth={false}
              onPress={() => go("Team")}
            />
          ) : undefined
        }
      />
      <ListGroup>
        <ListRow
          icon={Users}
          title={
            sumMissing
              ? "—"
              : `${data?.team.active ?? 0} active · ${data?.team.total ?? 0} total`
          }
          subtitle="Team members in your workspace"
          chevron={false}
        />
      </ListGroup>
    </Screen>
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
    <>
      <SectionHeader
        title={title}
        action={
          <Button
            label={cta}
            size="xs"
            variant="secondary"
            fullWidth={false}
            onPress={onCta}
          />
        }
      />
      <ListGroup>
        {rows.map((r) => (
          <ListRow
            key={r.id}
            title={r.name}
            value={money(r.amount)}
            chevron={false}
          />
        ))}
      </ListGroup>
    </>
  );
}
