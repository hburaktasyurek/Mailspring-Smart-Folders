'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const Module = require('node:module');
const test = require('node:test');

const SIDEBAR_MODULE_PATH = require.resolve('../lib/smart-folders-sidebar');
const LIBRARY_DIRECTORY = SIDEBAR_MODULE_PATH.slice(0, SIDEBAR_MODULE_PATH.lastIndexOf('/'));

function clearLibraryModules() {
  Object.keys(require.cache).forEach((modulePath) => {
    if (modulePath.startsWith(`${LIBRARY_DIRECTORY}/`)) {
      delete require.cache[modulePath];
    }
  });
}

function loadSidebar({loadRemote, resourcePath = '/Mailspring.app/Contents/Resources/app.asar'} = {}) {
  const originalLoad = Module._load;
  const hadAppEnv = Object.prototype.hasOwnProperty.call(global, 'AppEnv');
  const originalAppEnv = global.AppEnv;
  const hadWindow = Object.prototype.hasOwnProperty.call(global, 'window');
  const originalWindow = global.window;
  const hadDocument = Object.prototype.hasOwnProperty.call(global, 'document');
  const originalDocument = global.document;
  const hadMutationObserver = Object.prototype.hasOwnProperty.call(global, 'MutationObserver');
  const originalMutationObserver = global.MutationObserver;
  const state = {
    accounts: [{id: 'account-a'}],
    accountSidebarSections: [],
    confirmDeletion: true,
    currentPerspective: null,
    definitions: [],
    loadSettingsCalls: 0,
    dialogs: [],
    editorDefinitions: [],
    events: [],
    focusedPerspectives: [],
    inboxPerspectives: [],
    menuItems: [],
    mutationObservers: [],
    menus: [],
    popups: [],
    remoteRequests: [],
    removeCalls: [],
    storeListeners: new Set(),
    portalTargets: new Set(),
  };

  class Component {
    constructor(props) {
      this.props = props;
    }

    setState(update) {
      const nextState = typeof update === 'function' ? update(this.state, this.props) : update;
      this.state = {...this.state, ...nextState};
    }
  }

  const body = {
    contains(target) {
      return state.portalTargets.has(target);
    },
  };
  const document = {
    body,
    createElement() {
      const element = {
        className: '',
        remove() {
          state.portalTargets.delete(element);
        },
      };
      return element;
    },
    querySelectorAll(selector) {
      return selector === '.account-sidebar-sections' ? state.accountSidebarSections : [];
    },
  };
  class MutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      state.mutationObservers.push(this);
    }

    observe(target, options) {
      this.options = options;
      this.target = target;
    }

    disconnect() {
      this.disconnected = true;
    }
  }
  state.triggerMutations = () => {
    state.mutationObservers
      .filter((observer) => observer.target && !observer.disconnected)
      .forEach((observer) => observer.callback([], observer));
  };

  class SmartFolderPerspective {
    constructor(definition) {
      this.definitionId = definition.id;
      this.name = definition.name;
    }

    isEqual(other) {
      return other && this.definitionId === other.definitionId && this.name === other.name;
    }
  }

  const smartFolderStore = {
    getAll() {
      return state.definitions;
    },

    getById(id) {
      return state.definitions.find((definition) => definition.id === id) || null;
    },

    listen(listener) {
      state.storeListeners.add(listener);
      return () => state.storeListeners.delete(listener);
    },

    remove(id) {
      state.events.push('remove');
      state.removeCalls.push(id);
      if (state.removeError) {
        throw state.removeError;
      }

      state.definitions = state.definitions.filter((definition) => definition.id !== id);
      [...state.storeListeners].forEach((listener) => listener());
    },
  };

  class Menu {
    constructor() {
      this.items = [];
      state.menus.push(this);
    }

    append(item) {
      this.items.push(item);
    }

    popup(options) {
      state.popups.push({menu: this, options});
    }
  }

  class MenuItem {
    constructor({click, label}) {
      this.click = click;
      this.label = label;
      state.menuItems.push(this);
    }
  }

  const electronRemote = {
    Menu,
    MenuItem,
  };
  const bundledElectronRemotePath = path.join(
    resourcePath,
    'node_modules',
    '@electron',
    'remote'
  );

  const mailspringExports = {
    AccountStore: {
      accounts() {
        return state.accounts;
      },
      listen() {
        return () => {};
      },
    },
    Actions: {
      focusMailboxPerspective(perspective) {
        state.focusedPerspectives.push(perspective);
      },
    },
    CategoryStore: {
      listen() {
        return () => {};
      },
    },
    FocusedPerspectiveStore: {
      current() {
        return state.currentPerspective;
      },
      listen() {
        return () => {};
      },
    },
    MailboxPerspective: {
      forInbox(accounts) {
        const perspective = {kind: 'inbox', accounts};
        state.inboxPerspectives.push(perspective);
        return perspective;
      },
    },
    React: {
      Component,
      createElement(type, props, ...children) {
        return {children, props: props || {}, type};
      },
    },
    ReactDOM: {
      createPortal(section) {
        return section;
      },
    },

  };

  global.AppEnv = {
    getLoadSettings() {
      state.loadSettingsCalls += 1;
      return {resourcePath};
    },
    showErrorDialog(error) {
      state.dialogs.push(error);
    },
  };
  global.window = {
    confirm() {
      return state.confirmDeletion;
    },
  };
  global.document = document;
  global.MutationObserver = MutationObserver;

  clearLibraryModules();
  Module._load = function loadWithFakes(request, parent, isMain) {
    if (request === 'mailspring-exports') {
      return mailspringExports;
    }
    if (request === 'mailspring-component-kit') {
      return {
        RetinaImg: {Mode: {ContentIsMask: 'mask', ContentPreserve: 'preserve'}},
      };
    }
    if (request === '@electron/remote' || request === bundledElectronRemotePath) {
      state.remoteRequests.push(request);
      return loadRemote ? loadRemote(request, electronRemote) : electronRemote;
    }
    if (request === './smart-folder-definitions') {
      return {resolveDefinition() { return {missingSources: []}; }};
    }
    if (request === './smart-folder-perspective') {
      return {
        SmartFolderPerspective,
        isSmartFolderPerspective(perspective) {
          return perspective instanceof SmartFolderPerspective;
        },
      };
    }
    if (request === './smart-folder-store') {
      return {smartFolderStore};
    }
    if (request === './smart-folder-editor') {
      return {
        openSmartFolderEditor(definition) {
          state.events.push('edit');
          state.editorDefinitions.push(definition || null);
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  let restored = false;
  const restore = () => {
    if (restored) {
      return;
    }

    restored = true;
    Module._load = originalLoad;
    clearLibraryModules();
    if (hadAppEnv) {
      global.AppEnv = originalAppEnv;
    } else {
      delete global.AppEnv;
    }
    if (hadWindow) {
      global.window = originalWindow;
    } else {
      delete global.window;
    }
    if (hadDocument) {
      global.document = originalDocument;
    } else {
      delete global.document;
    }
    if (hadMutationObserver) {
      global.MutationObserver = originalMutationObserver;
    } else {
      delete global.MutationObserver;
    }
  };

  try {
    return {
      Menu,
      MenuItem,
      Sidebar: require(SIDEBAR_MODULE_PATH),
      SmartFolderPerspective,
      state,
      restore,
    };
  } catch (error) {
    restore();
    throw error;
  }
}

function withSidebar(callback, options) {
  const harness = loadSidebar(options);
  try {
    return callback(harness);
  } finally {
    harness.restore();
  }
}

test('loads Mailspring bundled Electron remote when direct resolution is unavailable', {concurrency: false}, () => {
  const resourcePath = '/test/Mailspring.app/Contents/Resources/app.asar';
  const bundledElectronRemotePath = path.join(
    resourcePath,
    'node_modules',
    '@electron',
    'remote'
  );

  withSidebar(
    ({Sidebar, state}) => {
      assert.equal(typeof Sidebar, 'function');
      assert.deepEqual(state.remoteRequests, ['@electron/remote', bundledElectronRemotePath]);
      assert.equal(state.loadSettingsCalls, 1);
    },
    {
      resourcePath,
      loadRemote(request, electronRemote) {
        if (request === '@electron/remote') {
          const error = new Error("Cannot find module '@electron/remote'");
          error.code = 'MODULE_NOT_FOUND';
          throw error;
        }

        return electronRemote;
      },
    }
  );
});

test('rethrows unrelated Electron remote resolution errors', {concurrency: false}, () => {
  const error = new Error("Cannot find module 'missing-remote-dependency'");
  error.code = 'MODULE_NOT_FOUND';
  const requests = [];

  assert.throws(
    () =>
      loadSidebar({
        loadRemote(request) {
          requests.push(request);
          throw error;
        },
      }),
    (actual) => actual === error
  );

  assert.deepEqual(requests, ['@electron/remote']);
});

function createDefinition() {
  return {id: 'smart-folder-a', name: 'Projects'};
}


function findElement(element, predicate) {
  if (!element || typeof element !== 'object') {
    return null;
  }
  if (predicate(element)) {
    return element;
  }
  for (const child of element.children || []) {
    const found = findElement(child, predicate);
    if (found) {
      return found;
    }
  }
  return null;
}

function actionButton(row) {
  const button = findElement(
    row,
    (element) => element.type === 'button' && element.props.type === 'button'
  );
  assert.ok(button);
  return button;
}


test('waits for and attaches below All Accounts when the account sidebar appears', {concurrency: false}, () => {
  withSidebar(({Sidebar, state}) => {
    const sidebar = new Sidebar({});

    sidebar._attachToAccountSidebar();
    const observer = state.mutationObservers[0];

    assert.equal(state.mutationObservers.length, 1);
    assert.equal(observer.target, global.document.body);
    assert.deepEqual(observer.options, {childList: true, subtree: true});

    sidebar._attachToAccountSidebar();
    assert.equal(state.mutationObservers.length, 1);

    const allAccounts = {id: 'all-accounts'};
    const nextSection = {id: 'next-section'};
    const sections = {
      children: [allAccounts, nextSection],
      getClientRects() {
        return [{}];
      },
      insertBefore(target, before) {
        this.children.splice(this.children.indexOf(before), 0, target);
        state.portalTargets.add(target);
      },
    };
    state.accountSidebarSections = [sections];
    state.triggerMutations();

    assert.equal(sections.children[0], allAccounts);
    assert.equal(sections.children[1], sidebar.state.portalTarget);
    assert.equal(sections.children[2], nextSection);
    assert.equal(observer.disconnected, true);
  });
});

test('disconnects a pending account sidebar observer on unmount', {concurrency: false}, () => {
  withSidebar(({Sidebar, state}) => {
    const sidebar = new Sidebar({});

    sidebar._attachToAccountSidebar();
    const observer = state.mutationObservers[0];
    sidebar.componentWillUnmount();
    state.triggerMutations();

    assert.equal(observer.disconnected, true);
    assert.equal(sidebar.state.portalTarget, null);
  });
});

test('opens the native Edit/Delete menu from a row context menu without React placement', {concurrency: false}, () => {
  withSidebar(({Menu, MenuItem, Sidebar, state}) => {
    const definition = createDefinition();
    state.definitions = [definition];
    const sidebar = new Sidebar({});
    const row = sidebar._renderDefinition(definition, true);
    const eventOrder = [];

    row.props.onContextMenu({
      screenX: Number.MAX_SAFE_INTEGER,
      screenY: Number.MIN_SAFE_INTEGER,
      currentTarget: {
        focus() {
          eventOrder.push('focus');
        },
      },
      preventDefault() {
        eventOrder.push('prevent');
      },
      stopPropagation() {
        eventOrder.push('stop');
      },
    });

    assert.deepEqual(eventOrder, ['focus', 'prevent', 'stop']);
    assert.deepEqual(state.remoteRequests, ['@electron/remote']);
    assert.equal(state.loadSettingsCalls, 0);
    assert.equal(state.menus.length, 1);
    assert.equal(state.menuItems.length, 2);
    assert.equal(state.popups.length, 1);
    assert.ok(state.popups[0].menu instanceof Menu);
    assert.ok(state.popups[0].menu.items.every((item) => item instanceof MenuItem));
    assert.deepEqual(
      state.popups[0].menu.items.map((item) => item.label),
      ['Edit Smart Folder…', 'Delete Smart Folder']
    );
    assert.deepEqual(state.popups[0].options, {});
  });
});

test('opens the native Edit/Delete menu from an ellipsis click without React placement', {concurrency: false}, () => {
  withSidebar(({Menu, MenuItem, Sidebar, state}) => {
    const definition = createDefinition();
    state.definitions = [definition];
    const button = actionButton(new Sidebar({})._renderDefinition(definition, true));
    let stopped = 0;

    button.props.onClick({
      screenX: Number.MIN_SAFE_INTEGER,
      screenY: Number.MAX_SAFE_INTEGER,
      stopPropagation() {
        stopped += 1;
      },
    });

    assert.equal(stopped, 1);
    assert.equal(state.menus.length, 1);
    assert.equal(state.menuItems.length, 2);
    assert.ok(state.popups[0].menu instanceof Menu);
    assert.ok(state.popups[0].menu.items.every((item) => item instanceof MenuItem));
    assert.deepEqual(
      state.popups[0].menu.items.map((item) => item.label),
      ['Edit Smart Folder…', 'Delete Smart Folder']
    );
    assert.deepEqual(state.popups[0].options, {});
  });
});


test('resolves the latest definition when the native edit callback runs', {concurrency: false}, () => {
  withSidebar(({Sidebar, state}) => {
    const staleDefinition = createDefinition();
    const latestDefinition = {...staleDefinition, name: 'Renamed Projects'};
    state.definitions = [staleDefinition];
    const sidebar = new Sidebar({});

    sidebar._showActionsMenu(staleDefinition.id);
    state.definitions = [latestDefinition];
    state.popups[0].menu.items[0].click();

    assert.deepEqual(state.events, ['edit']);
    assert.deepEqual(state.editorDefinitions, [latestDefinition]);
  });
});

test('deletes an active smart folder from the native delete callback and returns to inbox', {concurrency: false}, () => {
  withSidebar(({Sidebar, SmartFolderPerspective, state}) => {
    const definition = createDefinition();
    state.definitions = [definition];
    state.currentPerspective = new SmartFolderPerspective(definition);
    const sidebar = new Sidebar({});
    sidebar._attachToAccountSidebar = () => {};
    sidebar.componentDidMount();

    sidebar._showActionsMenu(definition.id);
    state.popups[0].menu.items[1].click();

    assert.deepEqual(state.events, ['remove']);
    assert.deepEqual(state.removeCalls, [definition.id]);
    assert.deepEqual(state.definitions, []);
    assert.equal(state.focusedPerspectives.length, 1);
    assert.equal(state.focusedPerspectives[0], state.inboxPerspectives[0]);
    assert.deepEqual(state.dialogs, []);
  });
});

test('does nothing when a native menu callback finds no current definition', {concurrency: false}, () => {
  withSidebar(({Sidebar, state}) => {
    const definition = createDefinition();
    state.definitions = [definition];
    const sidebar = new Sidebar({});

    sidebar._showActionsMenu(definition.id);
    state.definitions = [];
    state.popups[0].menu.items[0].click();
    state.popups[0].menu.items[1].click();

    assert.deepEqual(state.events, []);
    assert.deepEqual(state.editorDefinitions, []);
    assert.deepEqual(state.removeCalls, []);
  });
});

test('edits a row on double-click without ellipsis double-click bubbling', {concurrency: false}, () => {
  withSidebar(({Sidebar, state}) => {
    const definition = createDefinition();
    state.definitions = [definition];
    const row = new Sidebar({})._renderDefinition(definition, true);
    const button = actionButton(row);
    let stopped = 0;

    row.props.onDoubleClick();
    button.props.onDoubleClick({
      stopPropagation() {
        stopped += 1;
      },
    });

    assert.equal(stopped, 1);
    assert.deepEqual(state.editorDefinitions, [definition]);
  });
});

test('shows the delete failure and keeps the smart folder unchanged', {concurrency: false}, () => {
  withSidebar(({Sidebar, state}) => {
    const definition = createDefinition();
    state.definitions = [definition];
    state.removeError = new Error('Unable to save smart folder definitions.');
    const sidebar = new Sidebar({});

    sidebar._deleteDefinition(definition);

    assert.deepEqual(state.removeCalls, [definition.id]);
    assert.deepEqual(state.definitions, [definition]);
    assert.deepEqual(state.focusedPerspectives, []);
    assert.deepEqual(state.dialogs, [{
      title: 'Unable to Delete Smart Folder',
      message: 'Unable to save smart folder definitions.',
    }]);
  });
});

test('does nothing when smart folder deletion is cancelled', {concurrency: false}, () => {
  withSidebar(({Sidebar, state}) => {
    const definition = createDefinition();
    state.confirmDeletion = false;
    state.definitions = [definition];
    const sidebar = new Sidebar({});

    sidebar._deleteDefinition(definition);

    assert.deepEqual(state.removeCalls, []);
    assert.deepEqual(state.definitions, [definition]);
    assert.deepEqual(state.focusedPerspectives, []);
    assert.deepEqual(state.dialogs, []);
  });
});
