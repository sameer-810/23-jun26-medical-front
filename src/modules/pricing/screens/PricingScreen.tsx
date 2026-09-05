import React, { useMemo, useState } from "react";
import {
  View,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import { palette, radius, space, layout } from "@shared/designSystem";
import { Text, VStack, HStack, Button, Banner } from "@shared/ui";
import { fmtMoney } from "@shared/format";
import { usePublicPlans } from "@modules/pricing/hooks/usePublicPlans";
import { PublicPlan } from "@modules/pricing/types";

/** The green "BEST VALUE" bar: 5px above and below one line of label-sm. */
const RIBBON_HEIGHT = 26;

type Nav = { navigate: (s: string) => void };
type Route = { params?: { plan?: string; pending?: boolean } };

/**
 * The full price list, with the breakdown the public landing page leaves out.
 *
 * WHERE THIS SITS IN THE FLOW. The public site shows a deliberately bare card
 * — plan name and per-month rate, nothing else — and every one of its buttons
 * lands on `/signup?plan=12m`. This is the page that comes after submitting
 * that form: the same four plans, now with what actually leaves the account
 * ("You pay ₹2,700 once"), what it would have cost month to month, and what
 * that saves. Two-stage on purpose — the client asked for the public cards to
 * lead with one number and for the arithmetic to appear once someone has
 * actually put their name in.
 *
 * WHY THERE IS NO PAY BUTTON. There is no payment gateway in this product yet
 * — that is coming later — and, more fundamentally, there is nobody to charge
 * at this point: signing up creates a workspace that WAITS for the platform
 * team to activate it, so there is no session and no customer record to bill.
 * A "Pay now" button here would be a button that cannot work. What the page
 * does instead is let the visitor mark which plan they want and tell them
 * plainly what happens next. When the gateway lands, `onChoose` below is the
 * one place that has to change.
 *
 * The figures are NOT computed here. They arrive derived from /plans, from the
 * same arithmetic the landing site uses, because a chemist reads the public
 * card and this page inside about ten seconds and they must agree exactly.
 */
export default function PricingScreen({
  navigation,
  route,
}: {
  navigation: Nav;
  route?: Route;
}) {
  const { width } = useWindowDimensions();
  const { data, isLoading, isError, refetch } = usePublicPlans();

  /** Which card they clicked on the way in, if they came from the price list. */
  const requested = route?.params?.plan;
  const justSignedUp = Boolean(route?.params?.pending);

  const plans = useMemo(() => data ?? [], [data]);
  const [chosen, setChosen] = useState<string | undefined>(requested);

  /* The recommended plan is the fallback selection: a page that highlights
     nothing gives the reader no starting point, and "Best value" is the
     answer we would give if asked. */
  const selected =
    plans.find((p) => p.code === chosen) ??
    plans.find((p) => p.isFeatured) ??
    plans[0];

  const columns = width >= 1120 ? 4 : width >= 720 ? 2 : 1;
  const gutter =
    width >= layout.wideBreakpoint
      ? layout.screenPadding
      : layout.screenPaddingPhone;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: palette.surface.secondary }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: gutter,
          paddingBottom: space["5xl"],
          alignItems: "center",
        }}
      >
        <VStack gap={space["2xl"]} style={{ width: "100%", maxWidth: 1160 }}>
          <VStack gap={space.md} align="center">
            <Image
              source={require("../../../../assets/brand/wordmark.png")}
              style={{ width: 132, height: 34, resizeMode: "contain" }}
              accessibilityIgnoresInvertColors
            />
            <Text variant="h2" tone="primary" style={{ textAlign: "center" }}>
              {justSignedUp ? "Choose your plan" : "Plusveda pricing"}
            </Text>
            <Text
              variant="body"
              tone="secondary"
              style={{ textAlign: "center", maxWidth: 620 }}
            >
              Every plan is the whole software — the same features, the same
              support, no charge per bill, per user or per medicine. The only
              thing that changes is how long you pay for at a time.
            </Text>
          </VStack>

          {/*
            Shown only when arriving straight from the signup form. It is the
            first thing that must be said: the registration worked, and there
            is nothing to log into yet. Leaving this out earns a support call
            the moment they try to sign in.
          */}
          {justSignedUp && (
            <Banner
              tone="warning"
              title="Registration received — your workspace is awaiting approval"
              message="You won't be able to sign in until our team activates it, usually within one working day. Pick the plan you want below and we'll set it up on the call."
            />
          )}

          {isLoading && (
            <View style={{ paddingVertical: space["4xl"] }}>
              <ActivityIndicator color={palette.teal[600]} />
            </View>
          )}

          {isError && (
            <Banner
              tone="danger"
              title="Could not load the price list"
              message="Check your connection and try again — nothing you entered has been lost."
            >
              <Button label="Retry" variant="secondary" onPress={refetch} />
            </Banner>
          )}

          {!isLoading && !isError && plans.length === 0 && (
            <Banner
              tone="info"
              title="Pricing is being finalised"
              message="We'll send you a quotation when we activate your workspace."
            />
          )}

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -space.sm,
            }}
          >
            {plans.map((plan) => (
              <View
                key={plan.id}
                style={{
                  width: `${100 / columns}%`,
                  padding: space.sm,
                }}
              >
                <PlanCard
                  plan={plan}
                  selected={selected?.code === plan.code}
                  onChoose={() => setChosen(plan.code)}
                />
              </View>
            ))}
          </View>

          {selected && (
            <VStack gap={space.md} align="center">
              <Text
                variant="body-sm"
                tone="secondary"
                style={{ textAlign: "center", maxWidth: 640 }}
              >
                {[
                  `You've chosen the ${selected.name} — ${fmtMoney(selected.total)}`,
                  ` for ${selected.termMonths} month${selected.termMonths === 1 ? "" : "s"}.`,
                  " Nothing is charged now and no card is stored; we'll confirm",
                  " it when we activate your workspace, and you can change your",
                  " mind until then.",
                ].join("")}
              </Text>
              <View>
                <Button
                  label="Back to sign in"
                  variant="secondary"
                  onPress={() => navigation.navigate("Login")}
                />
              </View>
            </VStack>
          )}
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * One plan, with the breakdown.
 *
 * The three ruled lines are keyed off `saves`, not off the row's position: the
 * month-to-month plan has no anchor to strike through, and striking "1 month"
 * is the bug the landing page shipped with for a day.
 */
function PlanCard({
  plan,
  selected,
  onChoose,
}: {
  plan: PublicPlan;
  selected: boolean;
  onChoose: () => void;
}) {
  const term = `${plan.termMonths} month${plan.termMonths === 1 ? "" : "s"}`;

  const rows: [string, string, boolean][] =
    plan.saves > 0
      ? [
          ["You pay", `${fmtMoney(plan.total)} once`, false],
          ["Instead of", fmtMoney(plan.reference), false],
          ["You save", fmtMoney(plan.saves), true],
        ]
      : [
          ["You pay", `${fmtMoney(plan.total)} once`, false],
          ["Covers", term, false],
          ["Tied in for", "Nothing", false],
        ];

  return (
    <Pressable
      onPress={onChoose}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${plan.name}, ${fmtMoney(plan.perMonth)} per month`}
      style={{
        flex: 1,
        backgroundColor: palette.surface.primary,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? palette.teal[600] : palette.border.default,
        overflow: "hidden",
      }}
    >
      {plan.isFeatured && (
        <View
          style={{
            backgroundColor: palette.teal[600],
            paddingVertical: 5,
            alignItems: "center",
          }}
        >
          <Text variant="label-sm" tone="inverse">
            BEST VALUE
          </Text>
        </View>
      )}

      <VStack
        gap={space.sm}
        style={{
          flex: 1,
          padding: layout.cardPadding,
          /* Only one card in the row wears the ribbon, so the other three have
             to reserve its height or their plan names ride 26px higher than
             its does. RIBBON_HEIGHT is the measured height of that green bar:
             two 5px paddings around one line of label-sm. */
          paddingTop: plan.isFeatured
            ? layout.cardPadding
            : layout.cardPadding + RIBBON_HEIGHT,
        }}
      >
        <HStack justify="space-between" align="center" gap={space.sm}>
          <Text variant="label-lg" tone="primary">
            {plan.name}
          </Text>
          {plan.badge ? (
            <View
              style={{
                backgroundColor: palette.success.bg,
                borderColor: palette.success.border,
                borderWidth: 1,
                borderRadius: radius.full,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Text variant="label-sm" tone="success">
                {plan.badge}
              </Text>
            </View>
          ) : null}
        </HStack>

        {/* Two lines' worth, reserved, so the ₹ figures and the ruled rows sit
            on the same line across four cards whose taglines wrap differently.
            On a phone the cards are stacked and there is nothing to line up,
            but the reserve is only ~18px and not worth branching for. */}
        <Text
          variant="body-sm"
          tone="tertiary"
          style={{ minHeight: 38 }}
          numberOfLines={2}
        >
          {plan.tagline}
        </Text>

        <HStack align="flex-end" gap={2}>
          <Text variant="h1" tone="primary">
            {fmtMoney(plan.perMonth)}
          </Text>
          <Text variant="body-sm" tone="tertiary" style={{ paddingBottom: 4 }}>
            /month
          </Text>
        </HStack>

        <VStack gap={0} style={{ marginTop: space.xs }}>
          {rows.map(([k, v, strong], i) => (
            <HStack
              key={k}
              justify="space-between"
              align="center"
              style={{
                paddingVertical: 7,
                borderTopWidth: 1,
                borderTopColor: palette.border.subtle,
                borderBottomWidth: i === rows.length - 1 ? 1 : 0,
                borderBottomColor: palette.border.subtle,
              }}
            >
              <Text variant="body-sm" tone="tertiary">
                {k}
              </Text>
              <Text
                variant="label"
                tone={strong ? "success" : "primary"}
                style={
                  /* "Instead of" is the anchor: struck through so it reads as
                     the price NOT being paid, rather than a second price. */
                  k === "Instead of"
                    ? { textDecorationLine: "line-through" }
                    : undefined
                }
              >
                {v}
              </Text>
            </HStack>
          ))}
        </VStack>

        <Button
          /* `auto` puts every card's button on one line: the cards stretch to
             the tallest in the row, and without this each button floats up
             under a tagline that wrapped to a different number of lines. */
          style={{ marginTop: "auto" }}
          label={selected ? "Selected" : `Choose ${term}`}
          variant={selected ? "primary" : "secondary"}
          icon={
            selected ? (
              <Check size={16} color={palette.text.inverse} strokeWidth={2.4} />
            ) : undefined
          }
          onPress={onChoose}
          fullWidth
        />
      </VStack>
    </Pressable>
  );
}
