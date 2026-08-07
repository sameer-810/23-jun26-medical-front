/**
 * Phone-only "scan to sell" button, centred at the bottom of the screen.
 *
 * On a phone the fastest possible sale is: pick up the pack, point the camera,
 * take the money. Getting there previously meant opening the drawer, tapping
 * Sales, then tapping Camera — three taps and a menu, one-handed, at a counter
 * with a customer waiting. This is the one action worth a permanent target.
 *
 * Centred rather than in a corner because it is reached with either thumb, and
 * hidden on desktop, where a barcode gun types into the search box and a
 * floating button would only cover content.
 */
import React from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScanLine } from "lucide-react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { palette, layout, shadows } from "@shared/designSystem";
import { Text } from "@shared/ui";

export function ScanFab() {
  const { width } = useWindowDimensions();
  const navigation = useNavigation<never>();
  const canSell = useAuthStore((s) => s.hasPermission)(
    PERMISSIONS.SALES_MANAGE,
  );

  // Desktop has the sidebar and a barcode gun; this would just be in the way.
  if (width >= layout.wideBreakpoint || !canSell) return null;

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={styles.safe}
      pointerEvents="box-none"
    >
      <View style={styles.wrap} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan a pack to start a sale"
          onPress={() =>
            // @ts-expect-error nested navigator params
            navigation.navigate("Sales", {
              screen: "NewSale",
              params: { autoScan: true },
            })
          }
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        >
          <ScanLine size={26} color="#FFFFFF" strokeWidth={2.2} />
          <Text variant="label-sm" style={styles.label}>
            Scan
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { position: "absolute", left: 0, right: 0, bottom: 0 },
  wrap: { alignItems: "center", paddingBottom: 14 },
  fab: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: palette.teal[600],
    alignItems: "center",
    justifyContent: "center",
    // A ring so the button reads as raised above whatever it covers.
    borderWidth: 3,
    borderColor: palette.surface.primary,
    ...shadows.lg,
  },
  label: { color: "#FFFFFF", marginTop: 1 },
});
