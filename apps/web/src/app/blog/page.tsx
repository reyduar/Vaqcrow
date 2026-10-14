import { AppShell } from "@/presentation/components/app-shell";
import { BlogListContainer } from "@/presentation/components/blog/blog-list";

/**
 * `/blog` — the public Blog (Feature #498, WU3). Like `/about` and `/explore`
 * it lives OUTSIDE the `(app)` group: no `RouteGate`, no auth, no session. The
 * header and footer come from the shared `AppShell`.
 */
export default function BlogPage() {
  return (
    <AppShell>
      <BlogListContainer />
    </AppShell>
  );
}
