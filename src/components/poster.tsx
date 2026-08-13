import { FilmIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A poster thumbnail, with a placeholder for the titles that have none.
 *
 * Posters come from the operator's own Radarr/Sonarr, which proxy TMDB and
 * TheTVDB. The hosts are unknown at build time, so next/image cannot be used
 * here and a plain <img> is the correct tool.
 *
 * Always renders a box, even with no image: a row of posters where one is
 * missing should keep its column, not close up around the gap.
 */
export function Poster({
  url,
  className,
}: {
  url: string | null;
  className?: string;
}) {
  const shared = "shrink-0 overflow-hidden rounded-sm bg-muted";

  if (!url) {
    return (
      <div
        className={cn(
          shared,
          "flex items-center justify-center text-muted-foreground",
          className,
        )}
        aria-hidden
      >
        <FilmIcon className="size-4" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      // Decorative: the title always sits next to it as real text.
      alt=""
      loading="lazy"
      decoding="async"
      className={cn(shared, "object-cover", className)}
    />
  );
}
