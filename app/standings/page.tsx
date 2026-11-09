import { redirect } from "next/navigation";
import { getCurrentSeason } from "@/lib/kblSeason";

export default function StandingsIndexPage() {
  redirect(`/standings/season/${getCurrentSeason().code}`);
}
