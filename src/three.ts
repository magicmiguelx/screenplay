import type { Page } from '@playwright/test';
import type { Demo } from './demo.js';

// Helpers for an app with a three.js scene that exposes
// `window.three = { camera, controls, gl, scene }` in development builds
// (the camera as a getter, so a view change that swaps cameras is seen).
// Everything here runs page.evaluate: the scene is read in the page.

type Vec3 = [number, number, number];

/** Where a point of the scene is on screen. */
export function screenOf(page: Page, p: Vec3, handle = 'three'): Promise<[number, number]> {
  return page.evaluate(([x, y, z, handle]) => {
    const { camera, gl } = (window as any)[handle];
    const v = new camera.position.constructor(x, y, z).project(camera);
    const r = gl.domElement.getBoundingClientRect();
    return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height] as [number, number];
  }, [p[0], p[1], p[2], handle] as const);
}

/**
 * Turn the view a full circle (or `turns` of one) about the orbit target
 * in `seconds`, drawn frame by frame (Demo.drawFrames) so the rotation is
 * smooth however slowly the renderer draws. The camera ends where it
 * started (a whole number of turns).
 */
export async function orbit(demo: Demo, secs: number, opts: { turns?: number; fps?: number; handle?: string } = {}) {
  const handle = opts.handle ?? 'three';
  const turns = opts.turns ?? 1;
  const start = await demo.page.evaluate(handle => {
    const { camera, controls } = (window as any)[handle];
    const d = camera.position.clone().sub(controls.target);
    return { x: d.x, y: d.y, z: d.z, target: controls.target.toArray() as Vec3 };
  }, handle);
  const radius = Math.hypot(start.x, start.z);
  const angle0 = Math.atan2(start.x, start.z);
  await demo.drawFrames(secs, async u => {
    const angle = angle0 + u * turns * 2 * Math.PI;
    await demo.page.evaluate(([a, r, y, t, handle]) => new Promise<void>(done => {
      const { camera, controls } = (window as any)[handle];
      camera.position.set(t[0] + Math.sin(a) * r, t[1] + y, t[2] + Math.cos(a) * r);
      controls.update();
      // Two frames: one to render the move, one so the screenshot sees it.
      requestAnimationFrame(() => requestAnimationFrame(() => done()));
    }), [angle, radius, start.y, start.target, handle] as const);
  }, { fps: opts.fps });
}
