import assert from 'node:assert/strict';
import { test } from 'node:test';
import devCommands from '../dist/main/dev-commands.js';

const { DEV_COMMANDS, isDevCommandId, isDevCommandInput, matchDevCommands } = devCommands;

test('only input starting with > is a command', () => {
  assert.equal(isDevCommandInput('>cache'), true);
  assert.equal(isDevCommandInput('  > cache'), true);
  assert.equal(isDevCommandInput('cache'), false);
  assert.equal(isDevCommandInput('a > b'), false);
});

test('a bare prefix lists every command', () => {
  assert.deepEqual(matchDevCommands('>').map((item) => item.commandId), DEV_COMMANDS.map((command) => command.id));
});

test('commands match Turkish titles and English keywords', () => {
  assert.deepEqual(matchDevCommands('>önbelle').map((item) => item.commandId), ['hard-reload', 'clear-cache']);
  assert.deepEqual(matchDevCommands('>cookies').map((item) => item.commandId), ['clear-site-data']);
  assert.deepEqual(matchDevCommands('> CİHAZ döndür').map((item) => item.commandId), ['rotate-device']);
  assert.deepEqual(matchDevCommands('>nothing-like-this'), []);
});

test('suggestions carry a unique key and the shortcut hint', () => {
  const [reload] = matchDevCommands('>hard');
  assert.deepEqual(reload, {
    kind: 'command',
    title: 'Önbelleği yok sayarak yenile',
    url: '>hard-reload',
    commandId: 'hard-reload',
    hint: '⇧⌘R',
  });
  assert.equal(new Set(matchDevCommands('>').map((item) => item.url)).size, DEV_COMMANDS.length);
});

test('command ids are validated', () => {
  assert.equal(isDevCommandId('devtools'), true);
  assert.equal(isDevCommandId('rm -rf'), false);
  assert.equal(isDevCommandId(undefined), false);
});
