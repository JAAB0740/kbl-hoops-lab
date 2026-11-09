import { redirect } from "next/navigation";
import { getCurrentSeason } from "@/lib/kblSeason";

export default function CompareIndexPage() {
  redirect(`/compare/season/${getCurrentSeason().code}`);
}
