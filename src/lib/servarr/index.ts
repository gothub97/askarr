import type { ArrInstance } from "@prisma/client";
import type { ArrConnection } from "./client";
import * as radarr from "./radarr";
import * as sonarr from "./sonarr";
import type {
  LookupResult,
  QualityProfile,
  RootFolder,
  SonarrMonitorMode,
  SystemStatus,
} from "./types";

export { ArrError, joinArrUrl } from "./client";
export type { ArrConnection } from "./client";
export * from "./types";
export { radarr, sonarr };

/** Narrows a stored instance to just the connection details. */
export function toConnection(
  instance: Pick<
    ArrInstance,
    "label" | "baseUrl" | "apiKey" | "allowSelfSigned"
  >,
): ArrConnection {
  return {
    label: instance.label,
    baseUrl: instance.baseUrl,
    apiKey: instance.apiKey,
    allowSelfSigned: instance.allowSelfSigned,
  };
}

/**
 * Radarr and Sonarr share these endpoints, so the connection test and the
 * profile/folder pickers work the same on both.
 */
export async function getStatus(
  connection: ArrConnection,
): Promise<SystemStatus> {
  return radarr.getStatus(connection);
}

export async function getQualityProfiles(
  connection: ArrConnection,
): Promise<QualityProfile[]> {
  return radarr.getQualityProfiles(connection);
}

export async function getRootFolders(
  connection: ArrConnection,
): Promise<RootFolder[]> {
  return radarr.getRootFolders(connection);
}

export async function lookup(
  instance: ArrInstance,
  term: string,
): Promise<LookupResult[]> {
  const connection = toConnection(instance);
  return instance.kind === "RADARR"
    ? radarr.lookupMovies(connection, term)
    : sonarr.lookupSeries(connection, term);
}

export async function lookupByExternalId(
  instance: ArrInstance,
  externalId: number,
): Promise<LookupResult | null> {
  const connection = toConnection(instance);
  return instance.kind === "RADARR"
    ? radarr.lookupMovieByTmdbId(connection, externalId)
    : sonarr.lookupSeriesByTvdbId(connection, externalId);
}

export interface AddParams {
  externalId: number;
  title: string;
  year: number | null;
  monitorMode: SonarrMonitorMode;
}

/** Pushes a title to the instance and returns the id it was given there. */
export async function addToInstance(
  instance: ArrInstance,
  params: AddParams,
): Promise<number> {
  const connection = toConnection(instance);

  if (instance.kind === "RADARR") {
    const movie = await radarr.addMovie(connection, {
      tmdbId: params.externalId,
      title: params.title,
      year: params.year,
      qualityProfileId: instance.qualityProfileId,
      rootFolderPath: instance.rootFolderPath,
      tagIds: instance.tagIds,
    });
    return movie.id ?? 0;
  }

  const series = await sonarr.addSeries(connection, {
    tvdbId: params.externalId,
    title: params.title,
    qualityProfileId: instance.qualityProfileId,
    rootFolderPath: instance.rootFolderPath,
    tagIds: instance.tagIds,
    monitorMode: params.monitorMode,
  });
  return series.id ?? 0;
}

/**
 * Re-monitors a title the instance already has and kicks off a search.
 *
 * Only worth calling when a lookup came back alreadyManaged with no file: the
 * request is then a no-op unless something puts it back under watch.
 */
export async function resumeOnInstance(
  instance: ArrInstance,
  arrId: number,
): Promise<void> {
  const connection = toConnection(instance);
  return instance.kind === "RADARR"
    ? radarr.resumeMovie(connection, arrId)
    : sonarr.resumeSeries(connection, arrId);
}
