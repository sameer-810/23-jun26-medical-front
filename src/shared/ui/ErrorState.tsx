/**
 * ErrorState — a failed fetch, named, with a Retry.
 *
 * Use instead of EmptyState whenever a query errors: an empty state is a caption
 * for a container that is legitimately empty, and `retry: false` is set globally
 * so a single failed request would otherwise render the onboarding copy.
 *
 * Built on Banner, not EmptyState, so it keeps the dense Banner treatment used
 * for every other status message — no illustration, no full-page panel.
 */
import React from "react";
import { apiErrorMessage } from "../api/apiClient";
import { Banner } from "./Banner";
import { Button } from "./Button";

interface Props {
  /** The query's `error`. Its server-sent message is shown verbatim. */
  error?: unknown;
  /** Name what failed: "Couldn't load your products". */
  title?: string;
  /** Overrides the server's message. */
  message?: string;
  /** The query's `refetch`. Omit when there is nothing to retry. */
  onRetry?: () => void;
  /** The query's `isFetching`, so Retry shows it is working. */
  retrying?: boolean;
  /**
   * A way forward when retrying is pointless — a 404 will 404 again. Shown
   * instead of Retry, so the banner never offers a button that cannot work.
   */
  actionLabel?: string;
  onAction?: () => void;
  style?: object;
}

/** Used when the failure carried no server message — a dead connection or a cold start. */
const FALLBACK =
  "The server didn't respond. Check your connection and try again.";

export function ErrorState({
  error,
  title = "Couldn't load this",
  message,
  onRetry,
  retrying,
  actionLabel,
  onAction,
  style,
}: Props) {
  return (
    <Banner
      tone="danger"
      title={title}
      message={message ?? apiErrorMessage(error, FALLBACK)}
      style={style}
    >
      {onAction && actionLabel ? (
        <Button
          label={actionLabel}
          variant="secondary"
          size="xs"
          fullWidth={false}
          onPress={onAction}
          style={{ marginTop: 8, alignSelf: "flex-start" }}
        />
      ) : onRetry ? (
        <Button
          label="Retry"
          variant="secondary"
          size="xs"
          fullWidth={false}
          loading={retrying}
          onPress={onRetry}
          style={{ marginTop: 8, alignSelf: "flex-start" }}
        />
      ) : null}
    </Banner>
  );
}
