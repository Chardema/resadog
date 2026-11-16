import { getLocalSeoMetadata, LocalSeoPage } from "../_components/LocalSeoPage";

const slug = "garde-chien-disneyland-paris";

export const metadata = getLocalSeoMetadata(slug);

export default function Page() {
  return <LocalSeoPage slug={slug} />;
}
