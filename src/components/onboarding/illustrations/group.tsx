import { Note, Plate } from "./chrome";

/**
 * The two group plates: adding the bot, and turning Topics on.
 *
 * The three circles in the topics plate carry Telegram's own forum icon
 * colours, and they are the only literal values in this folder. They come from
 * TOPIC_PLAN in src/lib/actions/chats.ts, where they are stored as the decimal
 * integers the Bot API wants:
 *
 *   7322096  -> #6fb9f0   Request
 *   16478047 -> #fb6f5f   Approval
 *   9367192  -> #8eee98   General
 *
 * They must not follow the theme. What the operator sees in Telegram after
 * pressing the button is these exact three colours, so the drawing has to match
 * them or it stops being a guide.
 */

const TOPIC_COLOURS = {
  request: "#6fb9f0",
  approval: "#fb6f5f",
  general: "#8eee98",
} as const;

/** Adding the bot to a group, and the service message that follows. */
export function PlateAddToGroup() {
  return (
    <Plate
      title="Adding the bot to a Telegram group from the group's member list"
      chatTitle="Movie Night"
      subtitle="4 members"
      height={184}
    >
      <text x={14} y={52} fontSize={9.5} fill="var(--plate-dim)">
        Group info, then Add members
      </text>

      <rect x={14} y={60} width={292} height={24} rx={4} fill="var(--plate-head)" />
      <circle cx={28} cy={72} r={7} fill="var(--plate-dim)" opacity={0.5} />
      <text x={42} y={76} fontSize={10} fill="var(--plate-dim)">
        Search…
      </text>

      <rect
        x={14}
        y={90}
        width={292}
        height={30}
        rx={4}
        fill="var(--plate-selected)"
        stroke="var(--plate-avatar)"
      />
      <circle cx={31} cy={105} r={9} fill="var(--plate-avatar)" />
      <path
        d="M27 105.5 30 108.5l5-5.5"
        stroke="var(--plate-avatar-ink)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <text x={47} y={102} fontSize={10.5} fontWeight={700} fill="var(--plate-ink)">
        Askarr
      </text>
      <text x={47} y={114} fontSize={9} fill="var(--plate-dim)" className="font-data">
        @my_askarr_bot
      </text>
      <path
        d="M288 99l6 6-6 6"
        stroke="var(--plate-avatar)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      <rect x={76} y={132} width={168} height={20} rx={10} fill="var(--plate-service)" />
      <text
        x={160}
        y={146}
        fontSize={9.5}
        fill="var(--plate-dim)"
        textAnchor="middle"
      >
        Askarr was added to the group
      </text>

      <Note y={172}>Then promote it to administrator, and say anything.</Note>
    </Plate>
  );
}

/** The Topics switch, and the three topics Askarr creates behind it. */
export function PlateTopics() {
  const rows = [
    { name: "Request", hint: "where people ask", fill: TOPIC_COLOURS.request },
    { name: "Approval", hint: "where admins decide", fill: TOPIC_COLOURS.approval },
    { name: "General", hint: "where it lands", fill: TOPIC_COLOURS.general },
  ];

  return (
    <Plate
      title="The Topics switch in a group's settings, and the three topics Askarr creates"
      chatTitle="Movie Night"
      subtitle="Group settings"
      height={194}
    >
      <rect x={14} y={46} width={292} height={28} rx={4} fill="var(--plate-head)" />
      <text x={26} y={64} fontSize={11} fill="var(--plate-ink)">
        Topics
      </text>
      <rect x={262} y={53} width={32} height={16} rx={8} fill="var(--plate-good)" />
      <circle cx={286} cy={61} r={6} fill="var(--plate-avatar-ink)" />

      <text x={14} y={94} fontSize={9.5} fill="var(--plate-dim)">
        Askarr then creates the three it needs:
      </text>

      {rows.map((row, index) => {
        const y = 102 + index * 28;
        return (
          <g key={row.name}>
            <rect x={14} y={y} width={292} height={24} rx={4} fill="var(--plate-in)" />
            <circle cx={28} cy={y + 12} r={7} fill={row.fill} />
            <text x={42} y={y + 16} fontSize={10.5} fill="var(--plate-ink)">
              {row.name}
            </text>
            <text x={112} y={y + 16} fontSize={9.5} fill="var(--plate-dim)">
              {row.hint}
            </text>
          </g>
        );
      })}
    </Plate>
  );
}
