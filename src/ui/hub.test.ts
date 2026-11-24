import { describe, expect, it } from 'vitest'
import { hubHref } from './hub'

describe('lien vers l’accueil (hub)', () => {
  it('mène à l’accueil quand Combat Prep est servi sous /sport/', () => {
    expect(hubHref('/sport/')).toBe('/')
  })
  it('n’existe pas sur GitHub Pages ni en développement, où il n’y a pas d’accueil', () => {
    expect(hubHref('/combat-prep/')).toBeNull()
    expect(hubHref('/')).toBeNull()
  })
})
