/**
 * ErrorState — "this didn't load", said out loud, with a way to try again.
 *
 * WHY THIS EXISTS. Every list screen branched on `items.length === 0` and
 * rendered its onboarding empty state, so a failed request was indistinguishable
 * from a brand-new pharmacy: 5,000 products became "No products yet — add your
 * first product", a short book full of stock-outs became "Nothing to reorder",
 * and a tamper-proof audit log became "No activity yet". The backend cold-starts
 * on Render and `retry: false` is set globally, so this was not an edge case —
 * it was the first thing a lot of people saw in the morning, and it made the app
 * lie about the state of the business.
 *
 * Deliberately built on Banner rather than on EmptyState. An empty state is a
 * caption for a container that is legitimately empty; a failure is a status
 * message about the app, and the codebase already has one shape for those. The
 * dashboard's finance panel arrived at exactly this treatment by hand (a danger
 * Banner plus a Retry) — this is that pattern extracted, not a new idea, so the
 * error looks the same everywhere it appears. No illustration, no full-page
 * panel: it is three lines and a small button, at Banner's density.
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
  /** Overrides the server's message. Rarely wanted — the server is specific. */
  message?: string;
  /** The query's `refetch`. Omit only when there is genuinely nothing to retry. */
  onRetry?: () => void;
  /** The query's `isFetching`, so Retry shows it is working. */
  retrying?: boolean;
  style?: object;
}

/**
 * The fallback matters as much as the message: most failures here are a dead
 * connection or a sleeping server, which produce no server message at all, and
 * "Something went wrong" tells a pharmacist nothing they can act on.
 */
const FALLBACK =
  "The server didn't respond. Check your connection and try again.";

export function ErrorState({
  error,
  title = "Couldn't load this",
  message,
  onRetry,
  retrying,
  style,
}: Props) {
  return (
    <Banner
      tone="danger"
      title={title}
      message={message ?? apiErrorMessage(error, FALLBACK)}
      style={style}
    >
      {onRetry ? (
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
