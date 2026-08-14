import { Incoming, Note, Outgoing, Plate } from "./chrome";

/**
 * The BotFather conversation, in five plates.
 *
 * The words in the bubbles are BotFather's actual replies, shortened to fit.
 * They are worth quoting rather than paraphrasing: someone following this holds
 * the real conversation next to the drawing and matches them line by line, and
 * an invented reply would make them think they had gone wrong.
 *
 * The token shown is not a token. It has BotFather's shape and none of its
 * digits, so nobody can mistake the illustration for a credential.
 */

const FAKE_TOKEN = "123456789:AAHc9…kQ4v2";

/** 1. Ask BotFather for a bot. */
export function PlateNewBot() {
  return (
    <Plate
      title="The BotFather chat, with the /newbot command sent and BotFather asking for a name"
      chatTitle="BotFather"
      subtitle="bot"
      height={180}
    >
      <Outgoing y={48} width={86} mono>
        /newbot
      </Outgoing>
      <Incoming
        y={84}
        width={250}
        lines={[
          "Alright, a new bot. How are we going to",
          "call it? Please choose a name for your bot.",
        ]}
      />
      <rect x={14} y={140} width={292} height={26} rx={13} fill="var(--plate-head)" />
      <text x={28} y={157} fontSize={10.5} fill="var(--plate-dim)">
        Message
      </text>
    </Plate>
  );
}

/** 2. The display name, then the username. */
export function PlateNaming() {
  return (
    <Plate
      title="Answering BotFather with a display name, then a username ending in bot"
      chatTitle="BotFather"
      subtitle="bot"
      height={180}
    >
      <Outgoing y={46} width={74}>
        Askarr
      </Outgoing>
      <Incoming
        y={80}
        width={254}
        lines={[
          "Good. Now let's choose a username for your",
          "bot. It must end in “bot”.",
        ]}
      />
      <Outgoing y={134} width={132} mono>
        my_askarr_bot
      </Outgoing>
    </Plate>
  );
}

/** 3. The reply that carries the token. The one plate that must be unmistakable. */
export function PlateToken() {
  return (
    <Plate
      title="BotFather's reply, with the line carrying the token marked"
      chatTitle="BotFather"
      subtitle="bot"
      height={172}
    >
      <Incoming
        y={46}
        width={268}
        lines={[
          "Done! Congratulations on your new bot.",
          "Use this token to access the HTTP API:",
        ]}
      />
      <rect x={14} y={92} width={268} height={30} rx={9} fill="var(--plate-in)" />
      <rect
        x={22}
        y={99}
        width={252}
        height={17}
        rx={3}
        fill="var(--plate-highlight)"
        stroke="var(--plate-highlight-line)"
      />
      <text
        x={30}
        y={111}
        fontSize={10}
        fill="var(--plate-highlight-ink)"
        className="font-data"
      >
        {FAKE_TOKEN}
      </text>
      <path
        d="M290 114h14M297 107l7 7-7 7"
        stroke="var(--plate-highlight-line)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Note y={142}>That line is the token. Copy the whole thing.</Note>
      <Note y={158} tone="dim">
        Keep it secret. It is the key to the bot.
      </Note>
    </Plate>
  );
}

/** 4. Privacy mode, which the whole design depends on. */
export function PlatePrivacy() {
  return (
    <Plate
      title="The /setprivacy command, with Enable chosen from BotFather's two buttons"
      chatTitle="BotFather"
      subtitle="bot"
      height={186}
    >
      <Outgoing y={46} width={106} mono>
        /setprivacy
      </Outgoing>
      <Incoming
        y={80}
        width={236}
        lines={[
          "'Enable' to keep privacy mode on. Your bot",
          "will only see commands and its own replies.",
        ]}
      />
      <rect
        x={14}
        y={132}
        width={139}
        height={26}
        rx={5}
        fill="var(--plate-out)"
        stroke="var(--plate-good)"
        strokeWidth={1.5}
      />
      <text
        x={83.5}
        y={149}
        fontSize={11}
        fontWeight={700}
        fill="var(--plate-on-out)"
        textAnchor="middle"
      >
        Enable
      </text>
      <rect x={159} y={132} width={139} height={26} rx={5} fill="var(--plate-head)" />
      <text
        x={228.5}
        y={149}
        fontSize={11}
        fill="var(--plate-dim)"
        textAnchor="middle"
      >
        Disable
      </text>
      <Note y={174} tone="good">
        Enable. This is the default, and Askarr depends on it.
      </Note>
    </Plate>
  );
}

/**
 * 5. Inline mode.
 *
 * Off by default on every new bot, and nothing outside this plate says so. The
 * README advertises `@yourbot dune` as a feature without mentioning the switch,
 * which is why inline search silently does nothing on a fresh install.
 */
export function PlateInline() {
  return (
    <Plate
      title="The /setinline command, and the placeholder answer that switches inline mode on"
      chatTitle="BotFather"
      subtitle="bot"
      height={198}
    >
      <Outgoing y={46} width={100} mono>
        /setinline
      </Outgoing>
      <Incoming
        y={80}
        width={246}
        lines={[
          "OK. Send me the placeholder your users will",
          "see in the input field.",
        ]}
      />
      <Outgoing y={134} width={178}>
        Search for a film or show
      </Outgoing>
      <Note y={186}>
        Now anyone Askarr knows can type @my_askarr_bot dune anywhere.
      </Note>
    </Plate>
  );
}
