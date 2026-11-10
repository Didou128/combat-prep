// Test de bout en bout : parcours complet dans Chromium (format iPhone puis PC).
import { createRequire } from 'node:module'
const { chromium, devices } = createRequire(import.meta.url)('playwright')
import assert from 'node:assert/strict'

const URL = process.env.APP_URL ?? 'http://localhost:4173/'
const SHOTS = process.env.SHOTS ?? '/tmp/shots'
// PW_CHANNEL=msedge pour utiliser Edge déjà installé au lieu du Chromium de Playwright
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {})
const errors = []

async function run(label, contextOpts) {
  const ctx = await browser.newContext({ ...contextOpts, acceptDownloads: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`${label} console: ${m.text()}`))

  await page.goto(URL)
  await page.getByRole('heading', { name: /Bonjour/ }).waitFor()
  await page.screenshot({ path: `${SHOTS}/${label}-1-accueil.png`, fullPage: true })

  // Calendrier : AMHE présent le dimanche, kick-boxing déplacé au mardi, génération
  await page.getByRole('link', { name: /Calendrier/ }).first().click()
  await page.getByRole('button', { name: /Générer ma semaine/ }).waitFor()
  const sunday = page.getByRole('region', { name: /^Dimanche/ })
  await sunday.getByRole('button', { name: /AMHE/ }).waitFor()
  await page.getByLabel('🥊 Kick-boxing cette semaine').selectOption('1')
  await page.getByRole('button', { name: /Générer ma semaine/ }).click()
  await page.getByText(/séance\(s\) de préparation proposée/).waitFor()
  const tuesday = page.getByRole('region', { name: /^Mardi/ })
  await tuesday.getByRole('button', { name: /Kick-boxing/ }).waitFor()
  const prepCards = page.locator('.session-card.cat-force, .session-card.cat-explosivite')
  assert.equal(await prepCards.count(), 3, 'trois séances de préparation générées')
  assert.equal(await tuesday.locator('.session-card.cat-force, .session-card.cat-explosivite').count(), 0, 'rien le jour du kick')
  assert.equal(await page.getByRole('region', { name: /^Samedi/ }).locator('.session-card.cat-force, .session-card.cat-explosivite').count(), 0, 'rien de lourd le samedi')
  await page.screenshot({ path: `${SHOTS}/${label}-2-calendrier.png`, fullPage: true })

  // Déplacer la séance A la veille du kick (lundi) -> avertissement
  await page.locator('.session-card', { hasText: 'A ·' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Lun', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByText(/point\(s\) d’attention/).waitFor()
  const warnText = await page.locator('.callout-warn').innerText()
  assert.match(warnText, /veille/i)
  // Remettre en place via régénération
  await page.getByRole('button', { name: /Générer ma semaine/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Régénérer' }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await page.locator('.callout-warn').waitFor({ state: 'detached' })
  if (await page.locator('.callout-warn').count()) console.log('WARN:', await page.locator('.callout-warn').evaluate((e) => e.textContent))
  assert.equal(await page.locator('.callout-warn').count(), 0, 'plus d’avertissement après régénération')

  // Ouvrir la séance B, passer en version domicile, démarrer
  await page.locator('.session-card', { hasText: 'B ·' }).click()
  await page.getByRole('button', { name: /Ouvrir la séance/ }).click()
  await page.getByRole('heading', { name: /Force haut du corps/ }).waitFor()
  await page.getByRole('button', { name: /Domicile/ }).click()
  await page.getByText('Pompes sur parallettes').waitFor()
  await page.screenshot({ path: `${SHOTS}/${label}-3-seance.png`, fullPage: true })
  await page.getByRole('button', { name: /Démarrer la séance/ }).click()

  // Mode entraînement
  await page.getByRole('heading', { name: 'Pompes sur parallettes' }).waitFor()
  await page.getByRole('button', { name: 'Augmenter Répétitions' }).click()
  await page.getByRole('button', { name: '2', exact: true }).click() // RIR 2
  await page.getByRole('button', { name: /Valider la série/ }).click()
  await page.getByRole('timer').waitFor()
  await page.getByText('Série 1', { exact: true }).waitFor()
  assert.equal(await page.getByLabel('Répétitions', { exact: true }).inputValue(), '9', 'série 2 pré-remplie avec la série 1')
  await page.screenshot({ path: `${SHOTS}/${label}-4-entrainement.png`, fullPage: true })
  await page.getByRole('button', { name: 'Passer' }).click()

  // Remplacer l'exercice
  await page.getByRole('button', { name: /Remplacer/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Pompes —/ }).click()
  await page.getByRole('heading', { name: 'Pompes', exact: true }).waitFor()

  // Terminer (partielle)
  await page.getByRole('button', { name: 'Terminer la séance' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await page.waitForURL(/#\/seance\//)
  await page.locator('.badge-partial').first().waitFor()

  // Persistance après rechargement
  await page.reload()
  await page.locator('.badge-partial').first().waitFor()
  await page.locator('.exercise-list .badge-done', { hasText: '1/3' }).waitFor() // attend le chargement des séries

  // Combat : compte rendu AMHE
  await page.goto(URL + '#/calendrier')
  await page.getByRole('region', { name: /^Dimanche/ }).getByRole('button', { name: /AMHE/ }).click()
  await page.getByRole('button', { name: /Ouvrir la séance/ }).click()
  await page.getByRole('button', { name: /Enregistrer — séance effectuée/ }).click()
  await page.locator('.badge-done').first().waitFor()

  // Semaine suivante : récurrences créées, kick au jour par défaut (mercredi)
  await page.goto(URL + '#/calendrier')
  await page.getByRole('button', { name: 'Semaine suivante' }).click()
  await page.getByRole('region', { name: /^Mercredi/ }).getByRole('button', { name: /Kick-boxing/ }).waitFor()
  await page.getByRole('button', { name: /Copier la semaine précédente/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Copier' }).click()
  await page.getByText(/séance\(s\) copiée/).waitFor()
  await page.getByRole('region', { name: /^Mardi/ }).getByRole('button', { name: /Kick-boxing/ }).waitFor()

  // Bibliothèque : filtre domicile
  await page.goto(URL + '#/bibliotheque')
  await page.getByLabel('Environnement').selectOption('home')
  const homeCount = await page.locator('.lib-item').count()
  await page.getByLabel('Environnement').selectOption('')
  const allCount = await page.locator('.lib-item').count()
  assert.ok(homeCount > 10 && homeCount < allCount, `filtre domicile ${homeCount}/${allCount}`)
  await page.screenshot({ path: `${SHOTS}/${label}-5-bibliotheque.png` })

  // Paramètres : export puis import
  await page.goto(URL + '#/parametres')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exporter/ }).click()])
  const file = await download.path()
  await page.locator('input[type=file]').setInputFiles(file)
  await page.getByRole('dialog').getByRole('button', { name: /Importer et remplacer/ }).click()
  await page.getByText('Sauvegarde importée').waitFor()
  await page.screenshot({ path: `${SHOTS}/${label}-6-parametres.png`, fullPage: true })

  await ctx.close()
  console.log(`✓ parcours ${label} OK`)
}

// Étape 4 : date figée au jeudi 29 octobre 2026 pour avoir des séances passées (manquées).
async function step4(label, contextOpts) {
  const ctx = await browser.newContext({ ...contextOpts })
  const page = await ctx.newPage()
  await page.clock.setFixedTime(new Date(2026, 9, 29, 10, 0))
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`${label} console: ${m.text()}`))

  // Semaine générée avec le kick-boxing le mercredi : les séances de lundi / mardi sont passées.
  await page.goto(URL + '#/calendrier')
  await page.getByRole('button', { name: /Générer ma semaine/ }).click()
  await page.getByText(/séance\(s\) de préparation proposée/).waitFor()

  // Accueil : séances manquées, options de réorganisation
  await page.getByRole('link', { name: /Accueil/ }).first().click()
  const missed = page.getByRole('region', { name: 'Séances manquées' })
  await missed.waitFor()
  const before = await missed.locator('.missed-item').count()
  assert.ok(before >= 1, 'au moins une séance manquée')
  await page.screenshot({ path: `${SHOTS}/${label}-7-manquees.png`, fullPage: true })
  const firstItem = missed.locator('.missed-item').first()
  await firstItem.locator('.option-list .btn').first().waitFor()
  const firstText = await firstItem.locator('.option-list .btn').first().innerText()
  await firstItem.locator('.option-list .btn').first().click()
  if (/^Ne pas rattraper/.test(firstText)) await page.getByRole('dialog').getByRole('button', { name: 'Ne pas rattraper' }).click()
  await page.waitForFunction((n) => document.querySelectorAll('.missed-item').length < n, before)
  // Les suivantes : ne pas rattraper
  for (let left = await page.locator('.missed-item').count(); left > 0; left--) {
    await page.locator('.missed-item').first().getByRole('button', { name: /Ne pas rattraper/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Ne pas rattraper' }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.waitForFunction((n) => document.querySelectorAll('.missed-item').length < n, left)
  }
  assert.equal(await page.getByRole('region', { name: 'Séances manquées' }).count(), 0, 'plus de séance manquée')

  // Calendrier : la réorganisation ne crée aucun avertissement (pas d'entassement)
  await page.getByRole('link', { name: /Calendrier/ }).first().click()
  await page.getByRole('button', { name: /Générer ma semaine/ }).waitFor()
  await page.locator('.week-grid').waitFor()
  assert.equal(await page.locator('.callout-warn').count(), 0, 'aucun conflit après réorganisation')
  for (const day of ['Jeudi', 'Vendredi', 'Samedi']) {
    assert.ok(await page.getByRole('region', { name: new RegExp(`^${day}`) }).locator('.session-card.cat-force, .session-card.cat-explosivite').count() <= 1, `une séance max le ${day}`)
  }

  // Récupération : point du jour avec fatigue et courbatures maximales → suggestion prudente
  await page.getByRole('link', { name: /Accueil/ }).first().click()
  const rec = page.getByRole('region', { name: 'Récupération du jour' })
  await rec.getByRole('button', { name: 'Faire le point' }).click()
  for (const [scale, v] of [['Qualité du sommeil', '3'], ['Énergie', '2'], ['Fatigue', '5'], ['Courbatures', '5'], ['Motivation', '3']]) {
    await rec.getByRole('group', { name: scale }).getByRole('button', { name: v, exact: true }).click()
  }
  await rec.getByRole('button', { name: 'Enregistrer' }).click()
  await rec.getByText('Récupération insuffisante').waitFor()
  assert.match(await rec.innerText(), /version allégée/)
  assert.match(await rec.innerText(), /indicatives/)
  await page.screenshot({ path: `${SHOTS}/${label}-8-recuperation.png`, fullPage: true })

  // Mobilité 5 min : création et démarrage
  await page.getByRole('button', { name: /^🧘 5 min/ }).click()
  await page.getByRole('heading', { name: /Mobilité flash/ }).waitFor()
  await page.getByRole('button', { name: /Démarrer la séance/ }).click()
  await page.getByRole('heading', { name: 'Fente du coureur avec rotation' }).waitFor()
  await page.getByRole('button', { name: /Valider la série/ }).click()
  await page.getByText('Série 1', { exact: true }).waitFor()

  // Progrès : graphiques, historique, récupération
  await page.getByRole('link', { name: /Progrès/ }).first().click()
  await page.getByRole('heading', { name: 'Charges' }).waitFor()
  await page.getByText(/Aucune série avec charge/).waitFor() // pas de fausses données
  const adh = page.locator('section', { has: page.getByRole('heading', { name: /Assiduité/ }) })
  await adh.locator('svg').waitFor()
  await adh.locator('g[role=button]').last().hover()
  await adh.locator('.chart-tip').waitFor()
  assert.match(await adh.locator('.chart-tip').innerText(), /Manquées : \d/)
  await page.screenshot({ path: `${SHOTS}/${label}-9-graphiques.png`, fullPage: true })

  await page.getByRole('tab', { name: /Historique/ }).click()
  await page.locator('.history-item').first().waitFor()
  assert.match(await page.locator('.history-list').innerText(), /Manquée|non rattrapée/i)
  await page.screenshot({ path: `${SHOTS}/${label}-10-historique.png`, fullPage: true })

  await page.getByRole('tab', { name: /Récupération/ }).click()
  await page.getByRole('heading', { name: /Score de récupération/ }).waitFor()
  await page.locator('.chart svg').waitFor()

  // Persistance après rechargement
  await page.reload()
  await page.getByRole('heading', { name: /Score de récupération/ }).waitFor()
  await page.getByText('Récupération insuffisante').waitFor()

  await ctx.close()
  console.log(`✓ étape 4 ${label} OK`)
}

if (!process.env.STEP4_ONLY) {
  await run('iphone', { ...devices['iPhone 13'], browserName: undefined })
  await run('pc', { viewport: { width: 1440, height: 900 } })
}
await step4('iphone', { ...devices['iPhone 13'], browserName: undefined })
await step4('pc', { viewport: { width: 1440, height: 900 } })
await browser.close()
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log('Aucune erreur JavaScript.')
