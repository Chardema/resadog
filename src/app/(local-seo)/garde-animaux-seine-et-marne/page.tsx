import { getLocalSeoMetadata, LocalSeoPage } from "../_components/LocalSeoPage";

const slug = "garde-animaux-seine-et-marne";

export const metadata = getLocalSeoMetadata(slug);

export default function Page() {
  return <LocalSeoPage slug={slug} />;
}
