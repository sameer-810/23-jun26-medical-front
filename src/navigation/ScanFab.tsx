/**
 * Home-only "scan to sell" button, centred at the bottom of the screen.
 *
 * On a phone the fastest possible sale is: pick up the pack, point the camera,
 * take the money. This is the one action worth a permanent target.
 *
 * Rendered BY the Dashboard, not by the navigator. It used to render app-wide,
 * which the audit reported twice over: it covered content on Receive Stock and
 * Receipt history, and tapping it there did nothing useful.
 *
 * Deliberately not solved by asking "which screen am I on?" — two attempts at
 * reading the focused route returned the shell's name rather than the page's
 * and hid the button everywhere, Home included. Letting the one screen that
 * wants it render it cannot misfire.
 *
 * Tapping asks which camera, because the two do different jobs and the app
 * cannot guess: a barcode scanner reads the printed EAN, while the pack reader
 * photographs the panel and reads the batch number as text — the case where a
 * strip has no barcode at all.
 */
import React, { useState } from "react";
import {
  View,
  Pressable,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScanLine, ScanText, X } from "lucide-react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { palette, layout, radius, shadows } from "@shared/designSystem";
import { Text, VStack, HStack } from "@shared/ui";

export function ScanFab() {
  const { width } = useWindowDimensions();
  const navigation = useNavigation<never>();
  const [asking, setAsking] = useState(false);
  const canSell = useAuthStore((s) => s.hasPermission)(
    PERMISSIONS.SALES_MANAGE,
  );

  // Desktop has the sidebar and a barcode gun; this would just be in the way.
  if (width >= layout.wideBreakpoint || !canSell) return null;

  /** `mode` picks which camera New Sale opens with. */
  const go = (mode: "qr" | "pack") => {
    setAsking(false);
    // @ts-expect-error nested navigator params
    navigation.navigate("Sales", {
      screen: "NewSale",
      params: { autoScan: mode },
    });
  };

  return (
    <>
      <SafeAreaView
        edges={["bottom"]}
        style={styles.safe}
        pointerEvents="box-none"
      >
        <View style={styles.wrap} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan a pack to start a sale"
            onPress={() => setAsking(true)}
            style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
          >
            <ScanLine size={26} color="#FFFFFF" strokeWidth={2.2} />
            <Text variant="label-sm" style={styles.label}>
              Scan
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <Modal
        visible={asking}
        transparent
        animationType="fade"
        onRequestClose={() => setAsking(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAsking(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <HStack align="center" justify="space-between">
              <Text variant="label-lg" tone="primary">
                What are you scanning?
              </Text>
              <Pressable
                onPress={() => setAsking(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={20} color={palette.text.tertiary} strokeWidth={2} />
              </Pressable>
            </HStack>

            <Choice
              icon={
                <ScanLine size={22} color={palette.teal[700]} strokeWidth={2} />
              }
              title="QR / barcode"
              sub="The printed barcode on the pack"
              onPress={() => go("qr")}
              label="Scan a QR code or barcode"
            />
            <Choice
              icon={
                <ScanText size={22} color={palette.teal[700]} strokeWidth={2} />
              }
              title="Batch number"
              sub="Reads the printed panel when there is no barcode"
              onPress={() => go("pack")}
              label="Read the batch number from the pack"
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Choice({
  icon,
  title,
  sub,
  onPress,
  label,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
    >
      <HStack gap={12} align="center">
        <View style={styles.choiceIcon}>{icon}</View>
        <VStack gap={2} flex={1}>
          <Text variant="label-lg" tone="primary">
            {title}
          </Text>
          <Text variant="body-sm" tone="tertiary">
            {sub}
          </Text>
        </VStack>
      </HStack>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { position: "absolute", left: 0, right: 0, bottom: 0 },
  /**
   * Sits above the phone tab bar, at the trailing edge.
   *
   * It used to be centred on the bottom edge, which is exactly where the tab
   * bar's middle destination now lives — the two would have overlapped, and a
   * circle covering a nav button is how you get mis-taps on the one control a
   * pharmacist uses most. Trailing-aligned and lifted clear is the standard
   * placement for a FAB coexisting with a navigation bar.
   */
  wrap: {
    alignItems: "flex-end",
    paddingRight: 16,
    paddingBottom: layout.tabBarHeight + 12,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.teal[600],
    alignItems: "center",
    justifyContent: "center",
    // A ring so the button reads as raised above whatever it covers.
    borderWidth: 3,
    borderColor: palette.surface.primary,
    ...shadows.lg,
  },
  label: { color: "#FFFFFF", marginTop: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(7,26,16,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: palette.surface.primary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    paddingBottom: 34,
    gap: 12,
  },
  choice: {
    borderWidth: 1,
    borderColor: palette.border.default,
    borderRadius: radius.md,
    padding: 14,
  },
  choicePressed: { backgroundColor: palette.teal[50] },
  choiceIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.teal[50],
    alignItems: "center",
    justifyContent: "center",
  },
});
