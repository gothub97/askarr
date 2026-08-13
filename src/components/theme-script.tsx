export const THEME_STORAGE_KEY = "theme";

/**
 * The no-flash script, rendered by the server layout into <head>.
 *
 * It has to run before first paint, otherwise a dark-theme reader gets a white
 * flash on every navigation. That means it cannot live in the React provider:
 * a script rendered by a client component never executes on the client, and
 * React 19 warns about exactly that. Rendered from a Server Component it only
 * ever appears in the server's HTML, which is the only place it does anything.
 *
 * Kept in sync with applyTheme() in theme-provider.tsx.
 */
const SOURCE = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||"system";
var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",d);
document.documentElement.style.colorScheme=d?"dark":"light";
}catch(e){}})()`.replace(/\n/g, "");

export function ThemeScript() {
  return (
    <script
      // The class it sets is meant to differ from the server's markup.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: SOURCE }}
    />
  );
}
