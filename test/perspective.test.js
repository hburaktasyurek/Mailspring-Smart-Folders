'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const LIBRARY_DIRECTORY = `${__dirname.slice(0, __dirname.lastIndexOf('/'))}/lib/`;

function clearLibraryModules() {
  Object.keys(require.cache).forEach((modulePath) => {
    if (modulePath.startsWith(LIBRARY_DIRECTORY)) {
      delete require.cache[modulePath];
    }
  });
}

function source(accountId, categoryId) {
  return {accountId, categoryId};
}

function category(accountId, id, role = 'inbox') {
  return {accountId, id, role};
}

function definition(sources) {
  return {id: 'smart-folder', name: 'Smart Folder', sources};
}

function createMailspringExports(categories) {
  const state = {
    forNothingCalls: 0,
    nothingThreads: {kind: 'nothing'},
    queries: [],
  };
  const categoriesBySource = new Map(
    categories.map((entry) => [JSON.stringify([entry.accountId, entry.id]), entry]),
  );

  class Matcher {
    constructor(attribute, operator, val) {
      this.attribute = attribute;
      this.operator = operator;
      this.val = val;
    }
  }

  class MailboxPerspective {
    constructor(categoriesForPerspective) {
      this.categoriesForPerspective = categoriesForPerspective;
    }
  }

  MailboxPerspective.forNothing = () => {
    state.forNothingCalls += 1;
    return {threads: () => state.nothingThreads};
  };

  class Query {
    constructor(model) {
      this.model = model;
      this.predicates = [];
      this.limitValue = undefined;
      this.distinctCalls = 0;
    }

    where(predicate) {
      this.predicates.push(predicate);
      return this;
    }

    limit(value) {
      this.limitValue = value;
      return this;
    }

    distinct() {
      this.distinctCalls += 1;
      return this;
    }

    matching(threads) {
      return threads.filter((thread) =>
        this.predicates.every((predicate) => predicate.evaluate(thread)),
      );
    }
  }

  const DatabaseStore = {
    findAll(model) {
      const query = new Query(model);
      state.queries.push(query);
      return query;
    },
  };

  class MutableQuerySubscription {
    constructor(query, options) {
      this.query = query;
      this.options = options;
    }
  }

  class Thread {}

  Thread.attributes = {
    subject: {name: 'subject'},
    categories: {
      containsAny(categoryIds) {
        const selectedIds = new Set(categoryIds);
        return {
          evaluate(thread) {
            return (thread.categories || []).some((threadCategory) =>
              selectedIds.has(threadCategory.id),
            );
          },
        };
      },
      tableNameForJoinAgainst() {
        return 'ThreadCategories';
      },
    },
    inAllMail: {
      equal(value) {
        return {
          evaluate(thread) {
            return thread.inAllMail === value;
          },
        };
      },
    },
  };

  const CategoryStore = {
    byId(accountId, categoryId) {
      return categoriesBySource.get(JSON.stringify([accountId, categoryId])) || null;
    },
  };

  return {
    mailspringExports: {
      CategoryStore,
      DatabaseStore,
      Matcher,
      MailboxPerspective,
      MutableQuerySubscription,
      Thread,
    },
    state,
  };
}

function loadPerspective(categories) {
  const fake = createMailspringExports(categories);
  const originalLoad = Module._load;

  clearLibraryModules();
  Module._load = function loadMailspringExports(request, parent, isMain) {
    if (request === 'mailspring-exports') {
      return fake.mailspringExports;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const {SmartFolderPerspective} = require('../lib/smart-folder-perspective');
    return {SmartFolderPerspective, state: fake.state};
  } finally {
    Module._load = originalLoad;
    clearLibraryModules();
  }
}

function matchingThreadIds(subscription, threads) {
  return subscription.query.matching(threads).map((thread) => thread.id);
}

test('selects the exact union of selected categories', () => {
  const inbox = category('account-a', 'inbox-a');
  const projects = category('account-b', 'projects-b');
  const {SmartFolderPerspective} = loadPerspective([inbox, projects]);
  const perspective = new SmartFolderPerspective(
    definition([source('account-a', 'inbox-a'), source('account-b', 'projects-b')]),
  );

  const subscription = perspective.threads();
  assert.deepEqual(
    matchingThreadIds(subscription, [
      {id: 'inbox-thread', inAllMail: true, categories: [inbox]},
      {id: 'projects-thread', inAllMail: true, categories: [projects]},
      {id: 'unselected-thread', inAllMail: true, categories: [{id: 'other'}]},
    ]),
    ['inbox-thread', 'projects-thread'],
  );
  assert.equal(subscription.query.limitValue, 0);
  assert.deepEqual(subscription.options, {
    emitResultSet: true,
    updateOnSeparateThread: true,
  });
  assert.equal(perspective.canReceiveThreadsFromAccountIds(), false);
  assert.deepEqual(perspective.actionsForReceivingThreads(), []);
});

test('requests SQL DISTINCT for overlapping categories in one account', () => {
  const inbox = category('account-a', 'inbox-a');
  const projects = category('account-a', 'projects-a');
  const {SmartFolderPerspective} = loadPerspective([inbox, projects]);
  const perspective = new SmartFolderPerspective(
    definition([source('account-a', 'inbox-a'), source('account-a', 'projects-a')]),
  );

  const subscription = perspective.threads();
  assert.equal(subscription.query.distinctCalls, 1);
  assert.deepEqual(
    matchingThreadIds(subscription, [
      {id: 'overlap', inAllMail: true, categories: [inbox, projects]},
    ]),
    ['overlap'],
  );
});

test('preserves cross-account copies and account identity without unnecessary deduplication', () => {
  const inboxA = category('account-a', 'inbox-a');
  const inboxB = category('account-b', 'inbox-b');
  const {SmartFolderPerspective} = loadPerspective([inboxA, inboxB]);
  const perspective = new SmartFolderPerspective(
    definition([source('account-a', 'inbox-a'), source('account-b', 'inbox-b')]),
  );

  const subscription = perspective.threads();
  assert.deepEqual(perspective.accountIds, ['account-a', 'account-b']);
  assert.equal(subscription.query.distinctCalls, 0);
  assert.deepEqual(
    matchingThreadIds(subscription, [
      {id: 'thread-in-account-a', inAllMail: true, categories: [inboxA]},
      {id: 'thread-in-account-b', inAllMail: true, categories: [inboxB]},
    ]),
    ['thread-in-account-a', 'thread-in-account-b'],
  );
});

test('keeps valid sources when another source is unavailable', () => {
  const inbox = category('account-a', 'inbox-a');
  const {SmartFolderPerspective} = loadPerspective([inbox]);
  const perspective = new SmartFolderPerspective(
    definition([source('account-a', 'inbox-a'), source('account-a', 'removed-a')]),
  );

  assert.deepEqual(perspective.categories(), [inbox]);
  assert.equal(perspective.emptyMessage(), 'No messages in this Smart Folder.');
  assert.deepEqual(
    matchingThreadIds(perspective.threads(), [
      {id: 'valid-source-thread', inAllMail: true, categories: [inbox]},
      {id: 'removed-source-thread', inAllMail: true, categories: [{id: 'removed-a'}]},
    ]),
    ['valid-source-thread'],
  );
});

test('uses the empty perspective and explanatory message when no sources resolve', () => {
  const {SmartFolderPerspective, state} = loadPerspective([]);
  const perspective = new SmartFolderPerspective(
    definition([
      source('account-a', 'removed-a'),
      {accountId: '', categoryId: 'malformed-source'},
      null,
    ]),
  );

  assert.deepEqual(perspective.categories(), []);
  assert.equal(
    perspective.emptyMessage(),
    'None of this Smart Folder’s sources are currently available.',
  );
  assert.strictEqual(perspective.threads(), state.nothingThreads);
  assert.equal(state.forNothingCalls, 1);
  assert.equal(state.queries.length, 0);
});

test('applies normal, hidden, and mixed visibility rules through matcher evaluation', () => {
  const normal = category('account-a', 'inbox-a');
  const hidden = category('account-a', 'spam-a', 'spam');
  const unselected = category('account-a', 'other-a');

  const normalPerspective = new (loadPerspective([normal]).SmartFolderPerspective)(
    definition([source('account-a', 'inbox-a')]),
  );
  assert.deepEqual(
    matchingThreadIds(normalPerspective.threads(), [
      {id: 'normal-visible', inAllMail: true, categories: [normal]},
      {id: 'normal-hidden', inAllMail: false, categories: [normal]},
      {id: 'normal-unselected', inAllMail: true, categories: [unselected]},
    ]),
    ['normal-visible'],
  );

  const hiddenPerspective = new (loadPerspective([hidden]).SmartFolderPerspective)(
    definition([source('account-a', 'spam-a')]),
  );
  assert.deepEqual(
    matchingThreadIds(hiddenPerspective.threads(), [
      {id: 'hidden-selected', inAllMail: false, categories: [hidden]},
      {id: 'hidden-unselected', inAllMail: false, categories: [unselected]},
    ]),
    ['hidden-selected'],
  );

  const {SmartFolderPerspective} = loadPerspective([normal, hidden]);
  const mixedPerspective = new SmartFolderPerspective(
    definition([source('account-a', 'inbox-a'), source('account-a', 'spam-a')]),
  );
  assert.deepEqual(
    matchingThreadIds(mixedPerspective.threads(), [
      {id: 'mixed-visible-normal', inAllMail: true, categories: [normal]},
      {id: 'mixed-hidden-normal', inAllMail: false, categories: [normal]},
      {id: 'mixed-selected-hidden', inAllMail: false, categories: [hidden]},
      {id: 'mixed-unselected', inAllMail: true, categories: [unselected]},
      {id: 'mixed-hidden-leak', inAllMail: false, categories: [normal, unselected]},
    ]),
    ['mixed-visible-normal', 'mixed-selected-hidden'],
  );
});
