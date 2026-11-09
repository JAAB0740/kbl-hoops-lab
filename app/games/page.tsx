import { redirect } from "next/navigation";
import { getCurrentSeason } from "@/lib/kblSeason";

export default function GamesIndexPage() {
  redirect(`/games/season/${getCurrentSeason().code}`);
}
