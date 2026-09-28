import { redirect } from "next/navigation";

export default async function OrgHome(props: PageProps<"/o/[slug]">) {
  const { slug } = await props.params;
  redirect(`/o/${slug}/library`);
}
