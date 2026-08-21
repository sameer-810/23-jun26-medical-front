import React, { useState } from "react";
import { View } from "react-native";
import { ScrollText } from "lucide-react-native";
import { useAudit } from "@modules/admin/hooks/useAdmin";
import { AdminNav } from "@modules/admin/components/AdminNav";
import type { AuditEntry } from "@modules/admin/types";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  StatusChip,
  Pagination,
  DataTable,
  Column,
  Skeleton,
  ErrorState,
} from "@shared/ui";

export default function AuditScreen() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const { data, isLoading, isError, error, refetch, isRefetching } = useAudit({
    page,
    limit,
  });
  const items = data?.data ?? [];
  const meta = data?.meta;

  const columns: Column<AuditEntry>[] = [
    {
      key: "createdAt",
      header: "When",
      width: 180,
      sortable: true,
      sortValue: (a) => a.createdAt,
      render: (a) => (
        <Text variant="caption" tone="tertiary">
          {new Date(a.createdAt).toLocaleString("en-IN")}
        </Text>
      ),
    },
    {
      key: "adminEmail",
      header: "Actor",
      width: 220,
      sortable: true,
      sortValue: (a) => (a.adminEmail || "").toLowerCase(),
      render: (a) => (
        <Text variant="body-sm" tone="secondary" numberOfLines={1}>
          {a.adminEmail} · {a.entityType}
          {a.ip ? ` · ${a.ip}` : ""}
        </Text>
      ),
    },
    {
      key: "action",
      header: "Action",
      width: 160,
      render: (a) => <StatusChip label={a.action} tone="info" />,
    },
    {
      key: "description",
      header: "Description",
      width: 320,
      render: (a) => (
        <Text variant="body-sm" tone="primary" numberOfLines={2}>
          {a.description || "—"}
        </Text>
      ),
    },
  ];

  return (
    <Screen overline="Platform" title="Audit log">
      <AdminNav active="audit" />

      {/* An audit trail that renders "No activity yet" when it failed to load
          is worse than one that renders nothing — it makes a claim. */}
      {isError ? (
        <ErrorState
          error={error}
          title="Couldn't load the audit log"
          message="No events have been lost — this list didn't load. Try again."
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      ) : isLoading && items.length === 0 ? (
        <ListSkeleton />
      ) : (
        <View>
          <DataTable<AuditEntry>
            columns={columns}
            rows={items}
            keyExtractor={(a) => a._id}
            mobileCard={(a) => <AuditRow entry={a} />}
            emptyIcon={ScrollText}
            emptyTitle="No activity yet"
          />
          {meta && meta.total > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                limit={meta.limit}
                onPageChange={setPage}
                onLimitChange={(l) => {
                  setLimit(l);
                  setPage(1);
                }}
                label="events"
              />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function ListSkeleton() {
  return (
    <VStack gap={8}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <VStack gap={6}>
            <HStack gap={10} align="center" justify="space-between">
              <Skeleton width={90} height={16} />
              <Skeleton width={120} height={12} />
            </HStack>
            <Skeleton width="70%" height={12} />
          </VStack>
        </Card>
      ))}
    </VStack>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <Card>
      <VStack gap={6}>
        <HStack gap={10} align="center" justify="space-between">
          <StatusChip label={entry.action} tone="info" />
          <Text variant="caption" tone="tertiary">
            {new Date(entry.createdAt).toLocaleString("en-IN")}
          </Text>
        </HStack>
        {entry.description ? (
          <Text variant="body-sm" tone="primary">
            {entry.description}
          </Text>
        ) : null}
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {entry.adminEmail} · {entry.entityType}
          {entry.ip ? ` · ${entry.ip}` : ""}
        </Text>
      </VStack>
    </Card>
  );
}
