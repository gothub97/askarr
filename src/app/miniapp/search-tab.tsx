"use client";

import type { MediaKind } from "@prisma/client";
import type { InstanceOption } from "./types";
import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { MiniAppApiError, type MiniAppApi } from "./client";
import {
  DataTag,
  EmptyState,
  ErrorNote,
  Poster,
  Segmented,
  Sheet,
} from "./pieces";
import { haptic } from "./telegram";
import type { SearchResultDto, SubmitResponseDto } from "./types";

/**
 * Tab 2 — the same flow as the bot, with posters instead of a numbered list.
 *
 * The grid is the point: on a phone a poster is recognised faster than a title,
 * and picking the wrong Dune is the one mistake this screen has to prevent.
 */

const KIND_OPTIONS = [
  { value: "MOVIE" as MediaKind, label: "Movies" },
  { value: "SERIES" as MediaKind, label: "Series" },
];

export function SearchTab({
  api,
  instances,
  onRequested,
}: {
  api: MiniAppApi;
  instances: Record<MediaKind, InstanceOption[]>;
  onRequested: () => void;
}) {
  const [kind, setKind] = useState<MediaKind>("MOVIE");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchResultDto[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SearchResultDto | null>(null);

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setError("Type at least two characters to search.");
      return;
    }

    setSearching(true);
    setError(null);
    try {
      const body = await api.search(kind, trimmed);
      setResults(body.results);
      if (!body.ok) setError(body.error ?? "The search failed. Try again.");
    } catch (caught) {
      setResults(null);
      setError(
        caught instanceof MiniAppApiError
          ? caught.message
          : "The search failed. Try again.",
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Search">
      <Segmented
        label="What to look for"
        options={KIND_OPTIONS}
        value={kind}
        onChange={(next) => {
          setKind(next);
          // Results belong to the kind they were fetched for; keeping them
          // after a switch would show films under a Series heading.
          setResults(null);
          setError(null);
        }}
      />

      <form onSubmit={runSearch} className="flex gap-2">
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={kind === "MOVIE" ? "Search a film" : "Search a series"}
          enterKeyHint="search"
          autoComplete="off"
          aria-label={kind === "MOVIE" ? "Search a film" : "Search a series"}
          className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={searching}
          className="shrink-0 rounded-md border border-brand px-3 py-2 text-sm text-brand disabled:opacity-50"
        >
          <Search className="size-4" aria-hidden />
          <span className="sr-only">Search</span>
        </button>
      </form>

      {error && <ErrorNote message={error} />}

      {results === null && !error && (
        <EmptyState title="Search a title to request it." />
      )}

      {results !== null && results.length === 0 && !error && (
        <EmptyState title="Nothing matched. Try a different spelling." />
      )}

      {results !== null && results.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {results.map((result) => (
            <li key={result.externalId}>
              <button
                type="button"
                onClick={() => setSelected(result)}
                className="flex w-full flex-col gap-1 text-left"
              >
                <Poster
                  url={result.posterUrl}
                  className="aspect-[2/3] w-full"
                />
                <span className="line-clamp-2 text-xs text-foreground">
                  {result.title}
                </span>
                <DataTag>{result.year ?? "—"}</DataTag>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <DetailSheet
          api={api}
          kind={kind}
          result={selected}
          instances={instances[kind] ?? []}
          onClose={() => setSelected(null)}
          onRequested={onRequested}
        />
      )}
    </section>
  );
}

// ------------------------------------------------------------ detail sheet

function DetailSheet({
  api,
  kind,
  result,
  instances,
  onClose,
  onRequested,
}: {
  api: MiniAppApi;
  kind: MediaKind;
  result: SearchResultDto;
  instances: InstanceOption[];
  onClose: () => void;
  onRequested: () => void;
}) {
  // A single enabled instance is not a choice, so it is never shown as one.
  const [instanceId, setInstanceId] = useState<string>(instances[0]?.id ?? "");
  const [monitorMode, setMonitorMode] = useState<"all" | "lastSeason">("all");
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SubmitResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const body = await api.submit({
        kind,
        externalId: result.externalId,
        instanceId: instances.length > 1 ? instanceId : undefined,
        monitorMode: kind === "SERIES" ? monitorMode : null,
      });
      setOutcome(body);
      haptic(body.outcome === "error" ? "error" : "success");
      onRequested();
    } catch (caught) {
      haptic("error");
      setError(
        caught instanceof MiniAppApiError
          ? caught.message
          : "The request did not go through. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={result.title}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <Poster url={result.posterUrl} className="h-[132px] w-22" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DataTag>
              {result.year ?? "—"} ·{" "}
              {kind === "MOVIE" ? "tmdb" : "tvdb"}:{result.externalId}
            </DataTag>
            {result.alreadyManaged && (
              <p className="text-xs text-positive">
                Already in the library. Requesting adds you to its updates.
              </p>
            )}
          </div>
        </div>

        {result.overview && (
          <p className="text-sm text-muted-foreground">{result.overview}</p>
        )}

        {outcome === null && (
          <>
            {instances.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground">Where</p>
                <Segmented
                  label="Where it should go"
                  options={instances.map((instance) => ({
                    value: instance.id,
                    label: instance.label,
                  }))}
                  value={instanceId}
                  onChange={setInstanceId}
                />
              </div>
            )}

            {kind === "SERIES" && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground">How much</p>
                <Segmented
                  label="How much of the series"
                  options={[
                    { value: "all" as const, label: "Full series" },
                    {
                      value: "lastSeason" as const,
                      label: result.latestSeason
                        ? `Season ${result.latestSeason}`
                        : "Current season",
                    },
                  ]}
                  value={monitorMode}
                  onChange={setMonitorMode}
                />
                {monitorMode === "all" && (
                  <p className="text-xs text-muted-foreground">
                    A full series always goes to an admin for approval.
                  </p>
                )}
              </div>
            )}

            {error && <ErrorNote message={error} />}

            <button
              type="button"
              onClick={() => void confirm()}
              disabled={submitting}
              className="w-full rounded-md border border-brand px-3 py-3 text-sm text-brand disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Request it"}
            </button>
          </>
        )}

        {outcome !== null && (
          <div className="flex flex-col gap-3">
            <p
              role="status"
              className={
                outcome.outcome === "error" || outcome.outcome === "blocked"
                  ? "text-sm text-destructive"
                  : "text-sm text-foreground"
              }
            >
              {outcome.message}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-md border border-border px-3 py-3 text-sm text-foreground"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
