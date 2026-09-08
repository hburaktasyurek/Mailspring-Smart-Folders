const test = require('node:test');
const assert = require('node:assert/strict');

const Module = module.constructor;
const CONFIG_KEY = 'smart-folders.definitions';
const STORE_MODULE_PATH = require.resolve('../lib/smart-folder-store');
const LIB_ROOT = STORE_MODULE_PATH.slice(0, STORE_MODULE_PATH.lastIndexOf('/'));

function clearRepoLibModules() {
  Object.keys(require.cache).forEach((modulePath) => {
    if (modulePath.startsWith(`${LIB_ROOT}/`)) {
      delete require.cache[modulePath];
    }
  });
}

function requireSmartFolderStore() {
  const originalLoad = Module._load;

  try {
    Module._load = function loadWithMailspringExports(request, parent, isMain) {
      if (request === 'mailspring-exports') {
        return {CategoryStore: {}};
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    clearRepoLibModules();
    return require(STORE_MODULE_PATH).SmartFolderStore;
  } finally {
    Module._load = originalLoad;
  }
}

function createConfig(initialDefinitions = []) {
  const values = new Map([[CONFIG_KEY, initialDefinitions]]);
  const observers = new Set();
  const writes = [];
  let disposeCount = 0;

  return {
    get(key) {
      return values.get(key);
    },

    set(key, value) {
      values.set(key, value);
      writes.push(value);
      [...observers].forEach((observer) => {
        if (observer.key === key) {
          observer.listener();
        }
      });
      return true;
    },

    onDidChange(key, listener) {
      const observer = {key, listener};
      let disposed = false;
      observers.add(observer);

      return {
        dispose() {
          if (!disposed) {
            disposed = true;
            observers.delete(observer);
            disposeCount += 1;
          }
        },
      };
    },

    get writes() {
      return writes;
    },

    get activeObserverCount() {
      return observers.size;
    },

    get disposeCount() {
      return disposeCount;
    },
  };
}

function withStore(config, callback) {
  const hadAppEnv = Object.prototype.hasOwnProperty.call(global, 'AppEnv');
  const originalAppEnv = global.AppEnv;
  global.AppEnv = {config};

  try {
    const SmartFolderStore = requireSmartFolderStore();
    return callback(new SmartFolderStore());
  } finally {
    clearRepoLibModules();
    if (hadAppEnv) {
      global.AppEnv = originalAppEnv;
    } else {
      delete global.AppEnv;
    }
  }
}

const inbox = {
  accountId: 'account-a',
  categoryId: 'inbox',
  accountName: 'Personal',
  categoryName: 'Inbox',
};

const archive = {
  accountId: 'account-b',
  categoryId: 'archive',
  accountName: 'Work',
  categoryName: 'Archive',
};

test('persists ordered CRUD definitions, normalizes sources, and notifies listeners', {concurrency: false}, () => {
  const config = createConfig();

  withStore(config, (store) => {
    store.activate();
    store.activate();
    assert.equal(config.activeObserverCount, 1);

    let notificationCount = 0;
    store.listen(() => {
      notificationCount += 1;
    });

    const finance = store.create({
      name: '  Finance  ',
      sources: [
        inbox,
        {
          ...inbox,
          accountName: 'Old account label',
          categoryName: 'Old category label',
        },
      ],
    });
    const projects = store.create({name: 'Projects', sources: [archive]});

    assert.equal(finance.name, 'Finance');
    assert.deepEqual(finance.sources, [inbox]);
    assert.notEqual(finance.id, finance.name);
    assert.notEqual(projects.id, projects.name);
    assert.notEqual(finance.id, projects.id);
    assert.deepEqual(config.get(CONFIG_KEY), [finance, projects]);
    assert.deepEqual(store.getAll(), [finance, projects]);
    assert.deepEqual(store.getById(projects.id), projects);
    assert.equal(store.getById('missing-folder'), null);

    const updatedFinance = store.update(finance.id, {
      name: '  Household finance ',
      sources: [archive, inbox, archive],
    });

    assert.equal(updatedFinance.name, 'Household finance');
    assert.deepEqual(updatedFinance.sources, [archive, inbox]);
    assert.deepEqual(config.get(CONFIG_KEY), [updatedFinance, projects]);

    const removed = store.remove(projects.id);
    assert.deepEqual(removed, projects);
    assert.deepEqual(config.get(CONFIG_KEY), [updatedFinance]);
    assert.deepEqual(config.writes, [
      [finance],
      [finance, projects],
      [updatedFinance, projects],
      [updatedFinance],
    ]);
    assert.equal(notificationCount, 4);

    store.deactivate();
    assert.equal(config.activeObserverCount, 0);
    assert.equal(config.disposeCount, 1);

    config.set(CONFIG_KEY, config.get(CONFIG_KEY));
    assert.equal(notificationCount, 4);

    store.activate();
    config.set(CONFIG_KEY, config.get(CONFIG_KEY));
    assert.equal(notificationCount, 4);
    store.deactivate();
    assert.equal(config.disposeCount, 2);
  });
});

test('rejects invalid definitions and missing identifiers without persisting them', {concurrency: false}, () => {
  const config = createConfig();

  withStore(config, (store) => {
    assert.throws(
      () => store.create({name: '   ', sources: [inbox]}),
      /smart folder name is required/i
    );
    assert.throws(
      () => store.create({name: 'Receipts'}),
      /requires at least one source/i
    );
    assert.throws(
      () => store.create({name: 'Receipts', sources: [{accountId: 'account-a'}]}),
      /requires at least one valid source/i
    );

    const receipts = store.create({name: 'Receipts', sources: [inbox]});
    assert.throws(
      () => store.update(receipts.id, {name: '', sources: [archive]}),
      /smart folder name is required/i
    );
    assert.throws(
      () => store.update('missing-folder', {name: 'Other', sources: [archive]}),
      /smart folder not found/i
    );
    assert.throws(() => store.remove('missing-folder'), /smart folder not found/i);
    assert.deepEqual(config.get(CONFIG_KEY), [receipts]);
    assert.deepEqual(config.writes, [[receipts]]);
  });
});

test('reconstructs persisted definitions after a restart-like module reload', {concurrency: false}, () => {
  const config = createConfig();
  let persisted;

  withStore(config, (store) => {
    store.activate();
    const saved = store.create({
      name: '  Saved searches ',
      sources: [inbox, archive],
    });
    persisted = config.get(CONFIG_KEY);
    assert.deepEqual(persisted, [saved]);
    store.deactivate();
  });

  withStore(config, (restartedStore) => {
    assert.deepEqual(restartedStore.getAll(), persisted);
    assert.deepEqual(restartedStore.getById(persisted[0].id), persisted[0]);
  });
});
