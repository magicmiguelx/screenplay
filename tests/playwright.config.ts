import { defineConfig } from '@playwright/test';

// The smoke recording (smoke.spec.ts): a small page driven and recorded
// end to end, with the same browser flags a software-rendered WebGL app is
// recorded with.
export default defineConfig({
  testDir: '.',
  testMatch: /smoke\.spec\.ts/,
  timeout: 300_000,
  workers: 1,
  reporter: 'list',
  use: {
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
});
