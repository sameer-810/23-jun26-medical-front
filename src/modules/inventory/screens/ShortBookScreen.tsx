import React, { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ListChecks,
  Search,
  ShoppingBag,
  Pencil,
  Trash2,
} from "lucide-react-native";
import { inventoryApi } from "@modules/inventory/api/inventoryApi";
import { ShortbookItem } from "@modules/inventory/types";
import { apiErrorMessage } from "@api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { palette } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
  TextField,
  Pagination,
  DataTable,
  Column,
  Skeleton,
  Banner,
  ErrorState,
  PromptDialog,
  ConfirmDialog,
} from "@shared/ui";

export default function ShortBookScreen() {
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["inventory", "shortbook", search, page, limit],
    queryFn: () => inventoryApi.shortbook({ search, page, limit }),
  });

  const items = data?.data ?? [];
  const meta = data?.meta;

  /**
   * Editing and removing rows.
   *
   * A ShortBook row IS the reorder level — the list is every product whose
   * level is set and whose stock has fallen to it. So "edit" changes that
   * number, and "remove" clears it to zero. Neither deletes the medicine or
   * moves a single unit of stock, which is worth saying plainly on the
   * confirmation: the icon looks destructive and the action is not.
   */
  const canManage = useAuthStore((s) => s.hasPermission)(
    PERMISSIONS.PRODUCTS_MANAGE,
  );
  const [editing, setEditing] = useState<ShortbookItem | null>(null);
  const [removing, setRemoving] = useState<ShortbookItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["inventory", "shortbook"] });

  const saveLevel = async (value: string) => {
    if (!editing) return;
    setBusy(true);
    try {
      const r = await inventoryApi.setShortbookLevel(
        editing.productId,
        Math.max(0, Math.floor(Number(value) || 0)),
      );
      setNote(
        r.listed
          ? `${editing.name} — keep ${r.reorderLevel}, ${r.onHand} on hand, need ${r.need}.`
          : `${editing.name} is off the ShortBook. Its stock and history are unchanged.`,
      );
      setEditing(null);
      await refresh();
    } catch (e) {
      setNote(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await inventoryApi.removeFromShortbook(removing.productId);
      setNote(
        `${removing.name} removed from the ShortBook. The medicine, its batches and its stock are untouched.`,
      );
      setRemoving(null);
      await refresh();
    } catch (e) {
      setNote(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const createOrder = () =>
    navigation.navigate("Orders", {
      screen: "OrderForm",
      params: {
        seedLines: items.map((it) => ({
          productId: it.productId,
          productName: it.name,
          sku: it.sku,
          quantity: it.suggested || it.need || 1,
        })),
      },
    });

  const columns: Column<ShortbookItem>[] = [
    {
      key: "name",
      header: "Product",
      width: 240,
      sortable: true,
      sortValue: (it) => it.name.toLowerCase(),
      render: (it) => (
        <VStack gap={2}>
          <Text variant="label" tone="primary" numberOfLines={1}>
            {it.name}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {it.brandName || "—"} · {it.sku}
          </Text>
        </VStack>
      ),
    },
    {
      key: "onHand",
      header: "Stock / Min",
      width: 130,
      align: "center",
      sortable: true,
      sortValue: (it) => it.onHand,
      render: (it) => (
        <Text variant="body-sm" tone="secondary">
          {it.onHand} / {it.reorderLevel}
        </Text>
      ),
    },
    {
      key: "velocity",
      header: "Sold · cover",
      width: 130,
      align: "center",
      sortable: true,
      sortValue: (it) => it.dailyVelocity,
      render: (it) =>
        it.sold30 > 0 ? (
          <VStack gap={1} align="center">
            <Text variant="body-sm" tone="secondary">
              {it.sold30}/mo
            </Text>
            {it.daysCover != null ? (
              <StatusChip
                label={`${it.daysCover}d left`}
                tone={it.daysCover <= 7 ? "danger" : "warning"}
              />
            ) : null}
          </VStack>
        ) : (
          <Text variant="caption" tone="tertiary">
            no recent sales
          </Text>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: 90,
      render: (it) => (
        <StatusChip
          label={it.onHand === 0 ? "Out" : "Low"}
          tone={it.onHand === 0 ? "danger" : "warning"}
        />
      ),
    },
    {
      key: "suggested",
      header: "Order",
      width: 96,
      align: "right",
      sortable: true,
      sortValue: (it) => it.suggested ?? it.need,
      render: (it) => (
        <VStack gap={0} align="flex-end">
          <Text variant="label-lg" weight="700" tone="primary">
            {it.suggested ?? it.need}
          </Text>
          {it.suggested != null && it.suggested !== it.need ? (
            <Text variant="caption" tone="tertiary">
              min {it.need}
            </Text>
          ) : null}
        </VStack>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      key: "actions",
      header: "",
      width: 76,
      align: "center",
      render: (it) => (
        <RowActions
          onEdit={() => setEditing(it)}
          onRemove={() => setRemoving(it)}
          name={it.name}
        />
      ),
    });
  }

  return (
    <Screen
      overline="Inventory"
      title="ShortBook"
      subtitle="Items to reorder"
      right={
        items.length > 0 ? (
          <Button
            label="Create order"
            size="sm"
            icon={<ShoppingBag size={16} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={createOrder}
          />
        ) : undefined
      }
    >
      <View style={{ marginBottom: 12 }}>
        <TextField
          value={search}
          onChangeText={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search item, manufacturer"
          leading={
            <Search size={18} color={palette.text.tertiary} strokeWidth={1.8} />
          }
          autoCapitalize="none"
        />
      </View>

      {note ? (
        <Banner tone="info" message={note} style={{ marginBottom: 12 }} />
      ) : null}

      {isError ? (
        <ErrorState
          error={error}
          title="Couldn't load your reorder list"
          message="This is not an empty ShortBook — it didn't load. Retry before assuming there is nothing to order."
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      ) : isLoading && items.length === 0 ? (
        <ListSkeleton />
      ) : (
        <>
          <DataTable<ShortbookItem>
            columns={columns}
            rows={items}
            keyExtractor={(it) => it.productId}
            mobileCard={(it) => (
              <ShortBookRow
                item={it}
                canManage={canManage}
                onEdit={() => setEditing(it)}
                onRemove={() => setRemoving(it)}
              />
            )}
            emptyIcon={ListChecks}
            emptyTitle="Nothing to reorder"
          />
          {items.length > 0 && meta ? (
            <View style={{ marginTop: 16 }}>
              <Pagination
                page={meta.page}
                totalPages={meta.pages}
                total={meta.total}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={(l) => {
                  setLimit(l);
                  setPage(1);
                }}
                label="items"
              />
            </View>
          ) : null}
        </>
      )}

      {/* Edit = change how many to keep. Zero is spelled out as the way off the
          list, so nobody has to guess whether it's allowed. */}
      <PromptDialog
        visible={!!editing}
        title={editing ? `Keep how many of ${editing.name}?` : ""}
        message={
          editing
            ? `${editing.onHand} on hand now. Set 0 to take it off the ShortBook — nothing else changes.`
            : undefined
        }
        label="Minimum to keep"
        initialValue={editing ? String(editing.reorderLevel) : ""}
        placeholder="e.g. 20"
        keyboardType="number-pad"
        confirmLabel="Save"
        loading={busy}
        validate={(v) =>
          /^\d+$/.test(v.trim()) ? null : "Enter a whole number, 0 or more"
        }
        onSubmit={saveLevel}
        onCancel={() => setEditing(null)}
      />

      <ConfirmDialog
        visible={!!removing}
        title={removing ? `Remove ${removing.name}?` : ""}
        message="It comes off the reorder list. The medicine, its batches and its stock all stay as they are — add it again any time."
        confirmLabel="Remove"
        destructive
        loading={busy}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </Screen>
  );
}

/** Edit / remove, as icon buttons — the row is already dense with numbers. */
function RowActions({
  name,
  onEdit,
  onRemove,
}: {
  name: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <HStack gap={4} align="center" justify="center">
      <Pressable
        onPress={onEdit}
        hitSlop={8}
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel={`Edit how many ${name} to keep`}
      >
        <Pencil size={16} color={palette.text.secondary} strokeWidth={2} />
      </Pressable>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${name} from ShortBook`}
      >
        <Trash2 size={16} color={palette.danger.text} strokeWidth={2} />
      </Pressable>
    </HStack>
  );
}

function ShortBookRow({
  item,
  canManage,
  onEdit,
  onRemove,
}: {
  item: ShortbookItem;
  canManage: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      {/* Two rows on a phone, not one. Packing the name and four metric blocks
          into a single row left the name with no width at all — every medicine
          rendered as "Ca…", which is not a reorder list you can work from. */}
      <VStack gap={10}>
        <HStack gap={10} align="flex-start" justify="space-between">
          <VStack gap={2} flex={1}>
            <Text variant="label-lg" tone="primary" numberOfLines={2}>
              {item.name}
            </Text>
            <Text variant="body-sm" tone="tertiary" numberOfLines={1}>
              {item.brandName || "—"} · {item.sku}
            </Text>
          </VStack>
          {canManage ? (
            <RowActions name={item.name} onEdit={onEdit} onRemove={onRemove} />
          ) : null}
        </HStack>

        <HStack gap={12} align="center">
          <StatusChip
            label={item.onHand === 0 ? "Out" : "Low"}
            tone={item.onHand === 0 ? "danger" : "warning"}
          />
          <VStack gap={1} flex={1}>
            <Text variant="caption" tone="tertiary">
              Stock / Min
            </Text>
            <Text variant="body-sm" tone="secondary">
              {item.onHand} / {item.reorderLevel}
              {item.sold30 > 0
                ? ` · ${item.sold30}/mo${
                    item.daysCover != null ? ` · ${item.daysCover}d left` : ""
                  }`
                : ""}
            </Text>
          </VStack>
          <VStack gap={1} align="flex-end" style={styles.orderCell}>
            <Text variant="caption" tone="tertiary">
              Order
            </Text>
            <Text variant="label-lg" weight="700" tone="primary">
              {item.suggested ?? item.need}
            </Text>
            {item.suggested != null && item.suggested !== item.need ? (
              <Text variant="caption" tone="tertiary">
                min {item.need}
              </Text>
            ) : null}
          </VStack>
        </HStack>
      </VStack>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <VStack gap={8}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <HStack gap={14} align="center">
            <VStack gap={6} flex={1}>
              <Skeleton width="40%" height={16} />
              <Skeleton width="70%" height={12} />
            </VStack>
            <Skeleton width={70} height={16} />
          </HStack>
        </Card>
      ))}
    </VStack>
  );
}

const styles = StyleSheet.create({
  // 32px square — a tap target on a phone, not a 16px glyph.
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  orderCell: {
    minWidth: 44,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: palette.border.subtle,
  },
});
