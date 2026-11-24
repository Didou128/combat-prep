/** Chemin sous lequel l'accueil (dépôt hub) sert Combat Prep. */
const HUB_BASE = '/sport/'

/**
 * Adresse de l'accueil, ou null quand Combat Prep n'est pas servi par l'accueil
 * (GitHub Pages, développement) : le lien mènerait alors nulle part.
 */
export function hubHref(baseUrl: string): string | null {
  return baseUrl === HUB_BASE ? '/' : null
}
