import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The CLI, run as a project runs it: from the project root, the config
// found there unless --config names it. `cover` and `seen` read the scripts
// and need no voice key. (Every command was refused as unknown until
// October 2026: a flag left out dropped the command from the arguments.)

const CLI = resolve(import.meta.dirname, '../../dist/voiceover.js');

function project() {
  const root = mkdtempSync(join(tmpdir(), 'screenplay-cli-'));
  mkdirSync(join(root, 'scripts'));
  writeFileSync(join(root, 'screenplay.config.mjs'), "export default { scripts: 'scripts', videos: 'videos' };\n");
  const script = lines => JSON.stringify(lines);
  writeFileSync(join(root, 'scripts', '01-intro.vtt'), 'WEBVTT\n');
  writeFileSync(join(root, 'scripts', '01-intro.json'), script([
    { kind: 'card', start: 0.5, end: 4, caption: 'Intro. The idea.', voice: 'Intro. The idea.' },
    { kind: 'caption', start: 4.2, end: 8, caption: 'Click the item.', voice: 'Click the item.', at: 'bottom', cover: 0.2, seen: 1, subject: 'about: #item' },
  ]));
  writeFileSync(join(root, 'scripts', '02-more.vtt'), 'WEBVTT\n');
  writeFileSync(join(root, 'scripts', '02-more.json'), script([
    { kind: 'caption', start: 1, end: 5, caption: 'Over the table.', voice: 'Over the table.', at: 'top', cover: 0.7, seen: 0.6, subject: 'about: #table' },
  ]));
  return root;
}

const run = (root, ...args) => {
  const env = { ...process.env };
  delete env.ELEVENLABS_API_KEY;
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd: root, env, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
};

test('cover reads the config from the project root without any flag', () => {
  const root = project();
  try {
    const r = run(root, 'cover');
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /01-intro: 1 captions, worst 20%/);
    assert.match(r.out, /02-more: 1 captions, worst 70%, 1 over 50%/);
    assert.match(r.out, /1 of 2 captions over 50% content/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('names, --over, --under and --config, in any order', () => {
  const root = project();
  try {
    let r = run(root, 'cover', 'intro');
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /02-more/);
    r = run(root, 'cover', '--over', '0.8');
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /Every caption \(2\) under 80% content/);
    r = run(root, '--under', '0.5', 'seen');
    assert.equal(r.code, 0, r.out);
    r = run(root, 'seen');
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /60%  Over the table\.  \(about: #table\)/);
    r = run(tmpdir(), 'seen', '--config', join(root, 'screenplay.config.mjs'), '02');
    assert.equal(r.code, 1, r.out);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a wrong command, flag or share is refused with the usage', () => {
  const root = project();
  try {
    for (const args of [[], ['play'], ['cover', '--loud'], ['cover', '--over', 'lots'], ['cover', '--over', '2']]) {
      const r = run(root, ...args);
      assert.equal(r.code, 1, `${args.join(' ')}: ${r.out}`);
      assert.match(r.out, /Usage: screenplay-voiceover/, args.join(' '));
    }
    // A command that calls the voice service says it needs the key.
    const r = run(root, 'check');
    assert.equal(r.code, 1);
    assert.match(r.out, /Set ELEVENLABS_API_KEY/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
