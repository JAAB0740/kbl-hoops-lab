import { redirect } from "next/navigation";
import { getCurrentSeason } from "@/lib/kblSeason";

export default function PlayoffsIndexPage() {
  redirect(`/playoffs/season/${getCurrentSeason().code}`);
}
