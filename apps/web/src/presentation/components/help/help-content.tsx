import { HelpContact } from "./help-contact";
import { HelpExplorer } from "./help-explorer";

/**
 * `/help` content (Feature #394 / WU4): the interactive explorer (hero search,
 * categories and FAQ accordion) above the closing contact band. The route wraps
 * it in the public `AppShell`; nothing here reads auth, the session or the
 * router.
 */
export function HelpContent() {
  return (
    <div className="flex flex-col gap-10">
      <HelpExplorer />
      <HelpContact />
    </div>
  );
}
