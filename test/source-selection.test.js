'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const {buildCategoryTree} = require('../lib/category-tree');

const libDirectory = `${path.resolve(__dirname, '..', 'lib')}${path.sep}`;

function clearPluginModules() {
  Object.keys(require.cache).forEach((modulePath) => {
    if (modulePath.startsWith(libDirectory)) {
      delete require.cache[modulePath];
    }
  });
}

function loadDefinitions() {
  clearPluginModules();

  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === 'mailspring-exports') {
      return {CategoryStore: {}};
    }
    return originalLoad.apply(this, arguments);
  };

  try {
    return require('../lib/smart-folder-definitions');
  } finally {
    Module._load = originalLoad;
  }
}

test('buildCategoryTree connects unsorted categories by their exact hierarchy', () => {
  const archive = {id: 'archive', displayName: 'Archive'};
  const projects = {id: 'projects', displayName: 'Projects'};
  const alpha = {id: 'alpha', displayName: 'Projects.Alpha'};
  const release = {id: 'release', displayName: 'Projects.Alpha.Release'};

  const tree = buildCategoryTree([release, archive, alpha, projects], /\./g);

  assert.equal(tree.length, 2);
  assert.strictEqual(tree[0].category, archive);
  assert.strictEqual(tree[1].category, projects);
  assert.equal(tree[1].label, 'Projects');
  assert.equal(tree[1].children.length, 1);
  assert.strictEqual(tree[1].children[0].category, alpha);
  assert.equal(tree[1].children[0].label, 'Alpha');
  assert.equal(tree[1].children[0].children.length, 1);
  assert.strictEqual(tree[1].children[0].children[0].category, release);
  assert.equal(tree[1].children[0].children[0].label, 'Release');
  assert.deepEqual(tree[1].children[0].children[0].children, []);
});

test('buildCategoryTree keeps identical display paths scoped to each invocation', () => {
  const personalShared = {id: 'personal-shared', displayName: 'Shared'};
  const personalInbox = {id: 'personal-inbox', displayName: 'Shared.Inbox'};
  const workShared = {id: 'work-shared', displayName: 'Shared'};
  const workInbox = {id: 'work-inbox', displayName: 'Shared.Inbox'};

  const personalTree = buildCategoryTree([personalInbox, personalShared], /\./g);
  const workTree = buildCategoryTree([workInbox, workShared], /\./g);

  assert.strictEqual(personalTree[0].category, personalShared);
  assert.strictEqual(personalTree[0].children[0].category, personalInbox);
  assert.strictEqual(workTree[0].category, workShared);
  assert.strictEqual(workTree[0].children[0].category, workInbox);
  assert.notStrictEqual(personalTree[0].children[0].category, workTree[0].children[0].category);
});

test('definition source identities ignore labels while preserving valid snapshots', () => {
  const {normalizeDefinitions, snapshotSource, sourceKey} = loadDefinitions();
  const personalInbox = {
    accountId: 'personal-account',
    categoryId: 'inbox',
    accountName: 'Personal',
    categoryName: 'Inbox',
  };
  const workInbox = {
    accountId: 'work-account',
    categoryId: 'inbox',
    accountName: 'Work',
    categoryName: 'Inbox',
  };
  const personalProjects = {
    accountId: 'personal-account',
    categoryId: 'projects',
    accountName: 'Personal',
    categoryName: 'Projects',
  };

  assert.notEqual(sourceKey(personalInbox), sourceKey(workInbox));

  const definitions = normalizeDefinitions([
    null,
    'not a definition',
    {id: 'missing-sources', name: 'No sources'},
    {
      id: 'all-inboxes',
      name: '  All inboxes  ',
      sources: [
        personalInbox,
        {
          accountId: 'personal-account',
          categoryId: 'inbox',
          accountName: 'Changed label',
          categoryName: 'Other Inbox label',
        },
        workInbox,
        personalProjects,
        null,
        {},
        {accountId: 'personal-account'},
        {categoryId: 'inbox'},
        [],
      ],
    },
    {
      id: 'all-inboxes',
      name: 'Duplicate definition ID',
      sources: [workInbox],
    },
  ]);

  assert.deepEqual(definitions, [{
    id: 'all-inboxes',
    name: 'All inboxes',
    sources: [personalInbox, workInbox, personalProjects],
  }]);

  assert.deepEqual(
    snapshotSource(
      {id: 'personal-account', label: 'Personal'},
      {id: 'inbox', displayName: 'Inbox'}
    ),
    personalInbox
  );
});
