import { arrRequest, type ArrConnection } from "./client";
import {
  pickPoster,
  type LookupResult,
  type QualityProfile,
  type RadarrMovie,
  type RootFolder,
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

export async function lookupMovies(
  connection: ArrConnection,
  term: string,
): Promise<LookupResult[]> {
  const results = await arrRequest<RadarrMovie[]>(connection, {
    path: "/api/v3/movie/lookup",
    query: { term },
  });
  return (results ?? []).map(toLookupResult);
}

/** Looks a single title up by tmdbId, to re-check state at confirmation time. */
export async function lookupMovieByTmdbId(
  connection: ArrConnection,
  tmdbId: number,
): Promise<LookupResult | null> {
  const results = await arrRequest<RadarrMovie[]>(connection, {
    path: "/api/v3/movie/lookup",
    query: { term: `tmdb:${tmdbId}` },
  });
  const match = (results ?? []).find((movie) => movie.tmdbId === tmdbId);
  return match ? toLookupResult(match) : null;
}

/** Returns the movie if this instance already manages it, else null. */
export async function findExistingMovie(
  connection: ArrConnection,
  tmdbId: number,
): Promise<RadarrMovie | null> {
  const results = await arrRequest<RadarrMovie[]>(connection, {
    path: "/api/v3/movie",
    query: { tmdbId },
  });
  const match = (results ?? []).find(
    (movie) => movie.tmdbId === tmdbId && (movie.id ?? 0) > 0,
  );
  return match ?? null;
}

export interface AddMovieParams {
  tmdbId: number;
  title: string;
  year: number | null;
  qualityProfileId: number;
  rootFolderPath: string;
  tagIds: number[];
}

export async function addMovie(
  connection: ArrConnection,
  params: AddMovieParams,
): Promise<RadarrMovie> {
  return arrRequest<RadarrMovie>(connection, {
    method: "POST",
    path: "/api/v3/movie",
    body: {
      tmdbId: params.tmdbId,
      title: params.title,
      ...(params.year !== null ? { year: params.year } : {}),
      qualityProfileId: params.qualityProfileId,
      rootFolderPath: params.rootFolderPath,
      monitored: true,
      minimumAvailability: "released",
      tags: params.tagIds,
      addOptions: { searchForMovie: true },
    },
  });
}

export async function deleteMovie(
  connection: ArrConnection,
  arrId: number,
): Promise<void> {
  await arrRequest<void>(connection, {
    method: "DELETE",
    path: `/api/v3/movie/${arrId}`,
    query: { deleteFiles: false },
  });
}

function toLookupResult(movie: RadarrMovie): LookupResult {
  const arrId = movie.id ?? 0;
  return {
    externalId: movie.tmdbId,
    title: movie.title,
    year: movie.year ?? null,
    overview: movie.overview ?? null,
    posterUrl: pickPoster(movie.images),
    // An id greater than 0 means the instance manages it — not that it holds
    // a file, and not that it is looking for one.
    alreadyManaged: arrId > 0,
    hasFile: movie.hasFile === true,
    monitored: movie.monitored === true,
    arrId: arrId > 0 ? arrId : null,
    latestSeason: null,
  };
}

/**
 * Puts a movie the instance already holds back under watch and hunts for it.
 *
 * Radarr keeps unmonitored movies in the library and never searches for them,
 * so a request for one would otherwise be answered "we have it" and then do
 * nothing at all, forever. PUT wants the whole object back, so the current one
 * is read first rather than patched.
 */
export async function resumeMovie(
  connection: ArrConnection,
  arrId: number,
): Promise<void> {
  const movie = await arrRequest<RadarrMovie & Record<string, unknown>>(
    connection,
    { path: `/api/v3/movie/${arrId}` },
  );

  if (movie.monitored !== true) {
    await arrRequest(connection, {
      path: `/api/v3/movie/${arrId}`,
      method: "PUT",
      body: { ...movie, monitored: true },
    });
  }

  await arrRequest(connection, {
    path: "/api/v3/command",
    method: "POST",
    body: { name: "MoviesSearch", movieIds: [arrId] },
  });
}
