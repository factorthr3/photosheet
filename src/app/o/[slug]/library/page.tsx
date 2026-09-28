import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireOrg } from "@/lib/org";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage(props: PageProps<"/o/[slug]/library">) {
  const { slug } = await props.params;
  const { org } = await requireOrg(slug, "image:view");
  return (
    <>
      <PageHeader title="Library" description={`All images in ${org.name}.`} />
      <div className="flex flex-1 items-center justify-center p-12 text-sm text-muted-foreground">
        No images yet.
      </div>
    </>
  );
}
