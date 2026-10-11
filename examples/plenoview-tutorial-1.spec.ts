// The first Plenoview tutorial, as recorded on 2026-10-09 (one test of
// tests/e2e/demos.spec.ts in github.com/magicmiguelx/plenoview). It will not
// run here: `begin`, `intro`, `finish`, `example` and `still` are that spec's
// helpers (templates/demos.spec.ts has their shape) and `clickNode` wraps the
// kit's `clickSettled` around the app's own node positions. Read it for:
//
// - the opening card's own spoken text (the title plus the blurb would read
//   as a list);
// - `note()` over an action, `clearNote()` after it, `say()` for a line with
//   nothing to do under it;
// - a drag of the view in two short moves instead of one long one;
// - `voice` texts: a pause as "..." ("Today... and the Target"), "and" before
//   the last item of a list, a short caption given a sentence more aloud;
// - the poster taken early, on the example's best view.
//
test('1 · what is Plenoview', async ({ page }) => {
  const demo = await begin(page, {}, () => example(page, 'sap-fabric'));
  await intro(demo, 'overview', 'What is Plenoview? The idea, in a minute: platforms as layers, flow stages across them, and a story you can present.');

  await demo.poster(still('overview'));
  await demo.say('Most architecture diagrams are flat boxes and arrows. A plenoview shows your whole estate in three dimensions.');
  await demo.note('Each platform is a layer: here SAP below, Microsoft Fabric above.', { voice: 'Each platform is a layer. Here, SAP is below, and Microsoft Fabric is above.' });
  await demo.drag([760, 560], [900, 548], 8, 500);
  await demo.drag([900, 548], [770, 560], 8, 300);
  await demo.clearNote();
  await demo.say('The flow stages run left to right across every layer: Source, Ingest, Store, Process, Serve and Insight.', { voice: 'The flow stages run from left to right, across every layer: Source, Ingest, Store, Process, Serve, and Insight.' });

  await demo.note('Links cross platforms, so you see where the data really goes: here, everything S/4HANA feeds.', { voice: 'Links cross between platforms, so you can see where the data really goes. Here, everything that S/4HANA feeds lights up.' });
  await demo.clickNode('SAP S/4HANA', 900);
  await demo.click(page.locator('#properties .highlight-modes button[data-mode="downstream"]'), 2600);
  await demo.click(page.locator('#properties .highlight-modes button[data-mode="off"]'), 600);
  await demo.key('Escape', 500);
  await demo.clearNote();

  await demo.note('The timeline holds versions of the estate: Today, and the Target.', { voice: 'The timeline holds versions of the estate. Today... and the Target: where the plan says it should be.' });
  await demo.click(page.locator('.timeline-chips .chip').nth(0).locator('.chip-main'), 2600);
  await demo.click(page.locator('.timeline-chips .chip').nth(1).locator('.chip-main'), 2600);
  await demo.click(page.locator('.timeline-chips .chip.current .chip-main'), 1200);
  await demo.clearNote();

  await demo.note('And a tour turns it into a story you present, step by step.', { voice: 'And a tour turns it into a story. You present it full screen, one step at a time, with a caption for every step.' });
  await demo.click(page.locator('.tour-panel .present-tour'), 4200);
  await demo.key('ArrowRight', 4200);
  await demo.key('Escape', 1500);
  await demo.clearNote();

  await demo.say('Build yours by hand, from a picture, from a spreadsheet, or with Claude. These tutorials show you how.', { voice: 'Build yours by hand, from a picture, from a spreadsheet, or with Claude. These tutorials show you how.' });
  await finish(demo, 'overview');
});
