import { redirect } from "next/navigation";
import { getCurrentSeason } from "@/lib/kblSeason";

export default function TeamIndexPage() {
  redirect(`/team/season/${getCurrentSeason().code}`);
}
