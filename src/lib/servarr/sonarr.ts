import { arrRequest, type ArrConnection } from "./client";
import {
  pickPoster,
  type LookupResult,
  type QualityProfile,
  type RootFolder,
  type SonarrMonitorMode,
  type SonarrSeries,
  type SystemStatus,
} from "./types";

export async function getStatus(
  connection: ArrConnection,
): Promise<SystemStatus> {
  return arrRequest<SystemStatus>(connection, {
    path: "/api/v3/system/status",
  });
}

export async function getQualityProfiles(
  connection: ArrConnection,
): Promise<QualityProfile[]> {
  return arrRequest<QualityProfile[]>(connection, {
    path: "/api/v3/qualityprofile",
  });
}

export async function getRootFolders(
  connection: ArrConnection,
): Promise<RootFolder[]> {
  return arrRequest<RootFolder[]>(connection, { path: "/api/v3/rootfolder" });
}

export async function lookupSeries(
  connection: ArrConnection,
  term: string,
): Promise<LookupResult[]> {
  const results = await arrRequest<SonarrSeries[]>(connection, {
    path: "/api/v3/series/lookup",
    query: { term },
  });
  return (results ?? []).map(toLookupResult);
}

export async function lookupSeriesByTvdbId(
  connection: ArrConnection,
  tvdbId: number,
): Promise<LookupResult | null> {
  const results = await arrRequest<SonarrSeries[]>(connection, {
    path: "/api/v3/series/lookup",
    query: { term: `tvdb:${tvdbId}` },
  });
  const match = (results ?? []).find((series) => series.tvdbId === tvdbId);
  return match ? toLookupResult(match) : null;
}

/** Returns the series if this instance already manages it, else null. */
export async function findExistingSeries(
  connection: ArrConnection,
  tvdbId: number,
): Promise<SonarrSeries | null> {
  const results = await arrRequest<SonarrSeries[]>(connection, {
    path: "/api/v3/series",
    query: { tvdbId },
  });
  const match = (results ?? []).find(
    (series) => series.tvdbId === tvdbId && (series.id ?? 0) > 0,
  );
  return match ?? null;
}

export interface AddSeriesParams {
  tvdbId: number;
  title: string;
  qualityProfileId: number;
  rootFolderPath: string;
  tagIds: number[];
  monitorMode: SonarrMonitorMode;
}

export async function addSeries(
  connection: ArrConnection,
  params: AddSeriesParams,
): Promise<SonarrSeries> {
  return arrRequest<SonarrSeries>(connection, {
    method: "POST",
    path: "/api/v3/series",
    body: {
      tvdbId: params.tvdbId,
      title: params.title,
      qualityProfileId: params.qualityProfileId,
      rootFolderPath: params.rootFolderPath,
      monitored: true,
      seasonFolder: true,
      seriesType: "standard",
      languageProfileId: 1,
      tags: params.tagIds,
      addOptions: {
        monitor: params.monitorMode,
        searchForMissingEpisodes: true,
      },
    },
  });
}

export async function deleteSeries(
  connection: ArrConnection,
  arrId: number,
): Promise<void> {
  await arrRequest<void>(connection, {
    method: "DELETE",
    path: `/api/v3/series/${arrId}`,
    query: { deleteFiles: false },
  });
}

function toLookupResult(series: SonarrSeries): LookupResult {
  const arrId = series.id ?? 0;
  // Season 0 is the specials folder and is never what "current season" means.
  const realSeasons = (series.seasons ?? []).filter((s) => s.seasonNumber > 0);
  const latestSeason = realSeasons.length
    ? Math.max(...realSeasons.map((s) => s.seasonNumber))
    : null;

  return {
    externalId: series.tvdbId,
    title: series.title,
    year: series.year ?? null,
    overview: series.overview ?? null,
    posterUrl: pickPoster(series.images),
    alreadyManaged: arrId > 0,
    // A series is never wholly "there"; one episode on disk is what separates
    // "we have some of this" from "we have nothing".
    hasFile: (series.statistics?.episodeFileCount ?? 0) > 0,
    monitored: series.monitored === true,
    arrId: arrId > 0 ? arrId : null,
    latestSeason,
  };
}

/**
 * Puts a series the instance already holds back under watch and hunts for it.
 * Same reasoning as resumeMovie: unmonitored means Sonarr will never look.
 */
export async function resumeSeries(
  connection: ArrConnection,
  arrId: number,
): Promise<void> {
  const series = await arrRequest<SonarrSeries & Record<string, unknown>>(
    connection,
    { path: `/api/v3/series/${arrId}` },
  );

  if (series.monitored !== true) {
    await arrRequest(connection, {
      path: `/api/v3/series/${arrId}`,
      method: "PUT",
      body: { ...series, monitored: true },
    });
  }

  await arrRequest(connection, {
    path: "/api/v3/command",
    method: "POST",
    body: { name: "SeriesSearch", seriesId: arrId },
  });
}
