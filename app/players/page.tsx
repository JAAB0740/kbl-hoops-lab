import { redirect } from "next/navigation";
import { getCurrentSeason } from "@/lib/kblSeason";

export default function PlayersIndexPage() {
  redirect(`/players/season/${getCurrentSeason().code}`);
}
