/* Figma P07 세그먼트 카드의 픽셀 캐릭터 (연령대별 4종). 키는 BE 가 페르소나를 만들 때 정한다 */
export const PERSONA_AVATARS = ["20s", "30s", "40s", "50plus"] as const;
export type PersonaAvatarKey = (typeof PERSONA_AVATARS)[number];

export function isPersonaAvatar(value: string | null | undefined): value is PersonaAvatarKey {
  return PERSONA_AVATARS.includes(value as PersonaAvatarKey);
}
