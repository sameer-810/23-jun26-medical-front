import React, { useState } from "react";
import { View } from "react-native";
import { ScrollText } from "lucide-react-native";
import { useAuditLogs } from "@modules/team/hooks/useTeam";
import { ActivityLog } from "@modules/team/types";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  StatusChip,
  SearchInput,
  Pagination,
  DataTable,
  Column,
  Skeleton,
  ErrorState,
} from "@shared/ui";
import { fmtDateTime } from "@shared/format";

const ACTION_TONE = (
  action: string,
): "success" | "warning" | "danger" | "info" | "neutral" => {
  if (action.includes("login") || action.includes("signup")) return "info";
  if (action.includes("remove") || action.includes("delete")) return "danger";
  if (action.includes("create")) return "success";
  if (
    action.includes("update") ||
    action.includes("set_active") ||
    action.includes("reset")
  )
    return "warning";
  return "neutral";
};

export default function AuditLogScreen() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Filter change → back to page 1 (adjusted during render, not in an effect).
  const filterKey = `${search}|${limit}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useAuditLogs({
      ...(search.trim() ? { search: search.trim() } : {}),
      page,
      limit,
    });
  const logs = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.pages ?? 1;

  if (!isLoading && totalPages > 0 && page > totalPages) setPage(totalPages);

  const columns: Column<ActivityLog>[] = [
    {
      key: "createdAt",
      header: "When",
      width: 180,
      sortable: true,
      sortValue: (log) => log.createdAt,
      render: (log) => (
        <Text variant="body-sm" tone="tertiary">
          {formatWhen(log.createdAt)}
        </Text>
      ),
    },
    {
      key: "userName",
      header: "Actor",
      width: 180,
      sortable: true,
      sortValue: (log) => (log.userName || "").toLowerCase(),
      render: (log) => (
        <VStack gap={1}>
          <Text variant="label" tone="primary" numberOfLines={1}>
            {log.userName || "System"}
          </Text>
          {log.userRole ? (
            <Text variant="caption" tone="tertiary">
              {log.userRole}
            </Text>
          ) : null}
        </VStack>
      ),
    },
    {
      key: "action",
      header: "Action",
      width: 170,
      render: (log) => (
        <StatusChip label={log.action} tone={ACTION_TONE(log.action)} />
      ),
    },
    {
      key: "description",
      header: "Description",
      width: 280,
      render: (log) => (
        <Text variant="body-sm" tone="secondary" numberOfLines={2}>
          {log.description || `${log.entityType} ${log.action}`}
        </Text>
      ),
    },
  ];

  return (
    <Screen
      overline="Compliance"
      title="Audit Logs"
      subtitle={
        isError
          ? "Append-only, tamper-proof"
          : `${total.toLocaleString("en-IN")} entries · append-only, tamper-proof`
      }
      refreshing={isRefetching || isLoading}
      onRefresh={refetch}
    >
      <SearchInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search actions, users or descriptions"
      />

      {isError ? (
        <ErrorState
          error={error}
          title="Couldn't load the audit log"
          message="No entries have been lost — this list didn't load. Try again."
          onRetry={() => refetch()}
          retrying={isRefetching}
          style={{ marginTop: 16 }}
        />
      ) : isLoading && logs.length === 0 ? (
        <ListSkeleton />
      ) : (
        <View style={{ marginTop: 16 }}>
          <DataTable<ActivityLog>
            columns={columns}
            rows={logs}
            keyExtractor={(log) => log.id}
            mobileCard={(log) => <LogRow log={log} />}
            emptyIcon={ScrollText}
            emptyTitle="No activity yet"
            emptyMessage="Every sign-in and change will appear here."
          />
          {logs.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={setLimit}
                label="entries"
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
    <VStack gap={10} style={{ marginTop: 16 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Card key={i} elevation="base">
          <VStack gap={8}>
            <HStack align="center" justify="space-between" gap={8}>
              <Skeleton width={90} height={18} rounded="full" />
              <Skeleton width={70} height={12} />
            </HStack>
            <Skeleton width="80%" height={13} />
            <Skeleton width="40%" height={12} />
          </VStack>
        </Card>
      ))}
    </VStack>
  );
}

function LogRow({ log }: { log: ActivityLog }) {
  return (
    <Card elevation="base">
      <VStack gap={8}>
        <HStack align="center" justify="space-between" gap={8}>
          <StatusChip label={log.action} tone={ACTION_TONE(log.action)} />
          <Text variant="caption" tone="tertiary">
            {formatWhen(log.createdAt)}
          </Text>
        </HStack>
        <Text variant="body-sm" tone="secondary">
          {log.description || `${log.entityType} ${log.action}`}
        </Text>
        <HStack gap={8} align="center" wrap>
          <Text variant="caption" tone="tertiary">
            {log.userName || "System"}
          </Text>
          {log.userRole ? (
            <Text variant="caption" tone="tertiary">
              · {log.userRole}
            </Text>
          ) : null}
          {log.ipAddress ? (
            <Text variant="caption" tone="tertiary">
              · {log.ipAddress}
            </Text>
          ) : null}
        </HStack>
      </VStack>
    </Card>
  );
}

const formatWhen = fmtDateTime;
