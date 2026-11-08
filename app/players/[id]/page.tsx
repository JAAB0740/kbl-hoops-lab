import { redirect } from "next/navigation";
import { getCurrentSeason } from "@/lib/kblSeason";

interface Props {
  params: { id: string };
}

/**
 * 하위 호환 — /players/{id} 는 현재 시즌 상세로 redirect.
 * 과거 북마크 / 외부 링크 유지용.
 */
export default function PlayerDetailLegacyRedirect({ params }: Props) {
  redirect(`/players/season/${getCurrentSeason().code}/${params.id}`);
}
