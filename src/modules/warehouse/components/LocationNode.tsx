import React, { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Warehouse,
  Boxes,
  Columns3,
  Rows3,
  Grid3x3,
  Archive,
} from "lucide-react-native";
import { LocationTreeNode, LocationType } from "@modules/warehouse/types";
import { palette, radius } from "@shared/designSystem";
import { Text, HStack, StatusChip } from "@shared/ui";

const TYPE_ICON: Record<LocationType, any> = {
  warehouse: Warehouse,
  zone: Boxes,
  wall: Columns3,
  shelf: Rows3,
  rack: Grid3x3,
  drawer: Archive,
};

interface Props {
  node: LocationTreeNode;
  depth: number;
  canManage: boolean;
  onAddChild: (node: LocationTreeNode) => void;
  onRename: (node: LocationTreeNode) => void;
  onRemove: (node: LocationTreeNode) => void;
}

export function LocationNode({
  node,
  depth,
  canManage,
  onAddChild,
  onRename,
  onRemove,
}: Props) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const canAdd = node.allowedChildTypes.length > 0;
  const Icon = TYPE_ICON[node.type];

  return (
    <View>
      <View style={[styles.row, { paddingLeft: 12 + depth * 18 }]}>
        <Pressable
          onPress={() => hasChildren && setOpen((o) => !o)}
          hitSlop={6}
          style={styles.caret}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown
                size={16}
                color={palette.text.tertiary}
                strokeWidth={2}
              />
            ) : (
              <ChevronRight
                size={16}
                color={palette.text.tertiary}
                strokeWidth={2}
              />
            )
          ) : (
            <View style={{ width: 16 }} />
          )}
        </Pressable>

        <View
          style={[
            styles.iconWrap,
            node.type === "warehouse" && { backgroundColor: palette.teal[700] },
          ]}
        >
          <Icon
            size={15}
            color={node.type === "warehouse" ? "#FFFFFF" : palette.teal[600]}
            strokeWidth={2}
          />
        </View>

        <View style={{ flex: 1 }}>
          <HStack gap={8} align="center">
            <Text
              variant="label-lg"
              tone={node.isActive ? "primary" : "tertiary"}
              numberOfLines={1}
            >
              {node.name}
            </Text>
            <StatusChip label={node.code} tone="neutral" />
            {!node.isActive && <StatusChip label="Inactive" tone="danger" />}
          </HStack>
        </View>

        {canManage && (
          <HStack gap={2} align="center">
            {canAdd && (
              <Pressable
                onPress={() => onAddChild(node)}
                hitSlop={6}
                style={styles.action}
              >
                <Plus size={17} color={palette.teal[600]} strokeWidth={2.2} />
              </Pressable>
            )}
            <Pressable
              onPress={() => onRename(node)}
              hitSlop={6}
              style={styles.action}
            >
              <Pencil size={15} color={palette.text.tertiary} strokeWidth={2} />
            </Pressable>
            <Pressable
              onPress={() => onRemove(node)}
              hitSlop={6}
              style={styles.action}
            >
              <Trash2 size={15} color={palette.danger.text} strokeWidth={2} />
            </Pressable>
          </HStack>
        )}
      </View>

      {open &&
        node.children.map((child) => (
          <LocationNode
            key={child.id}
            node={child}
            depth={depth + 1}
            canManage={canManage}
            onAddChild={onAddChild}
            onRename={onRename}
            onRemove={onRemove}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.subtle,
  },
  caret: { width: 18, alignItems: "center" },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: palette.teal[50],
    alignItems: "center",
    justifyContent: "center",
  },
  action: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
