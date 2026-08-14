import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The pieces every onboarding plate is drawn from.
 *
 * These are illustrations, not screenshots. A capture of BotFather would weigh
 * a hundred times as much, freeze one language and one client version, carry
 * whatever happened to be in the operator's chat, and go stale the next time
 * Telegram restyles. Drawn, they follow the theme, translate with the rest of
 * the interface, and stay true because the conversation they depict is fixed by
 * the Bot API, not by the client.
 *
 * Telegram's shapes, Askarr's values: the bubbles are Telegram's geometry, and
 * every colour comes from a token in globals.css, so a plate sits inside the
 * wizard rather than on top of it. The only literals anywhere in this folder
 * are the three forum icon colours, which are Telegram's own and belong to
 * TOPIC_PLAN.
 */

/** 320 wide is the drawing grid; the SVG itself scales to its container. */
export const PLATE_WIDTH = 320;

const INK = "var(--plate-ink)";
const DIM = "var(--plate-dim)";

export function Plate({
  title,
  subtitle,
  chatTitle,
  height,
  children,
  className,
}: {
  /** The accessible name. Says what the plate shows, not what it depicts. */
  title: string;
  /** The line under the chat name in the title bar. */
  subtitle: string;
  chatTitle: string;
  height: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${PLATE_WIDTH} ${height}`}
      role="img"
      className={cn(
        "block h-auto w-full rounded-md border border-border",
        className,
      )}
    >
      <title>{title}</title>
      <rect width={PLATE_WIDTH} height={height} fill="var(--plate-shell)" />
      <rect width={PLATE_WIDTH} height={34} fill="var(--plate-head)" />
      <circle cx={20} cy={17} r={11} fill="var(--plate-avatar)" />
      <path
        d="M14.5 17.5 18 21l7.5-8"
        stroke="var(--plate-avatar-ink)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <text x={38} y={15} fontSize={11} fontWeight={700} fill={INK}>
        {chatTitle}
      </text>
      <text x={38} y={26} fontSize={9} fill={DIM}>
        {subtitle}
      </text>
      <line x1={0} y1={34} x2={PLATE_WIDTH} y2={34} stroke="var(--plate-line)" />
      {children}
    </svg>
  );
}

/**
 * A message from the operator: right-aligned, Telegram blue.
 *
 * `width` is passed rather than measured because SVG has no text metrics before
 * layout, and a bubble that wraps its own text is a worse illustration than one
 * sized by hand to the string it carries.
 */
export function Outgoing({
  y,
  width,
  children,
  mono,
}: {
  y: number;
  width: number;
  children: string;
  mono?: boolean;
}) {
  const x = PLATE_WIDTH - 14 - width;
  return (
    <>
      <rect x={x} y={y} width={width} height={26} rx={9} fill="var(--plate-out)" />
      <path d={`M${x + width} ${y + 26}v-8c0 5 2 7 5 8z`} fill="var(--plate-out)" />
      <text
        x={x + 11}
        y={y + 17}
        fontSize={11}
        fill="var(--plate-on-out)"
        className={mono ? "font-data" : undefined}
      >
        {children}
      </text>
    </>
  );
}

/** A reply from BotFather: left-aligned, one line per array entry. */
export function Incoming({
  y,
  width,
  lines,
}: {
  y: number;
  width: number;
  lines: readonly string[];
}) {
  const lineHeight = 13;
  const height = 12 + lines.length * lineHeight;
  return (
    <>
      <rect x={14} y={y} width={width} height={height} rx={9} fill="var(--plate-in)" />
      <path d={`M14 ${y + height}v-8c0 5-2 7-5 8z`} fill="var(--plate-in)" />
      {lines.map((line, index) => (
        <text
          key={line}
          x={25}
          y={y + 16 + index * lineHeight}
          fontSize={10.5}
          fill={INK}
        >
          {line}
        </text>
      ))}
    </>
  );
}

/** A caption in the brand hue, for the one thing the plate is pointing at. */
export function Note({
  y,
  children,
  tone = "brand",
}: {
  y: number;
  children: string;
  tone?: "brand" | "good" | "dim";
}) {
  const fill =
    tone === "good"
      ? "var(--plate-good)"
      : tone === "dim"
        ? DIM
        : "var(--plate-note)";
  return (
    <text x={14} y={y} fontSize={9.5} fill={fill}>
      {children}
    </text>
  );
}
