import { redirect } from "next/navigation";

/**
 * There is no public landing page. The middleware normally redirects "/" long
 * before this renders; this exists so the root is still correct if middleware
 * has failed open (a database that is not up yet, for instance).
 */
export default function RootPage() {
  redirect("/dashboard");
}
