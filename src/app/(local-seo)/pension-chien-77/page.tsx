import { getLocalSeoMetadata, LocalSeoPage } from "../_components/LocalSeoPage";

const slug = "pension-chien-77";

export const metadata = getLocalSeoMetadata(slug);

export default function Page() {
  return <LocalSeoPage slug={slug} />;
}
