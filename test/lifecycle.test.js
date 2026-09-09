'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const LIBRARY_DIRECTORY = require.resolve('../lib/main').replace(/main\.js$/, '');

function clearLibraryModules() {
  Object.keys(require.cache).forEach((modulePath) => {
    if (modulePath.startsWith(LIBRARY_DIRECTORY)) {
      delete require.cache[modulePath];
    }
  });
}

function loadPlugin() {
  const originalLoad = Module._load;
  const accounts = [{id: 'account-a'}];
  const state = {
    accountListenerDisposals: 0,
    categoryListenerDisposals: 0,
    closeModalCalls: 0,
    currentPerspective: null,
    focusedPerspectives: [],
    inboxPerspectives: [],
    smartFolderVisibilityDeactivations: 0,
    storeDeactivations: 0,
    unregisteredComponents: [],
  };

  class Component {
    constructor(props) {
      this.props = props;
    }

    setState() {}
  }

  class SmartFolderPerspective {}
  class SmartFoldersSidebar {}

  const mailspringExports = {
    AccountStore: {
      accounts() {
        return accounts;
      },
      listen() {
        return () => {
          state.accountListenerDisposals += 1;
        };
      },
    },
    Actions: {
      closeModal() {
        state.closeModalCalls += 1;
      },
      focusMailboxPerspective(perspective) {
        state.focusedPerspectives.push(perspective);
      },
    },
    CategoryStore: {
      listen() {
        return () => {
          state.categoryListenerDisposals += 1;
        };
      },
    },
    ComponentRegistry: {
      register() {},
      unregister(component) {
        state.unregisteredComponents.push(component);
      },
    },
    FocusedPerspectiveStore: {
      current() {
        return state.currentPerspective;
      },
    },
    MailboxPerspective: {
      forInbox(inboxAccounts) {
        const perspective = {kind: 'inbox', accounts: inboxAccounts};
        state.inboxPerspectives.push(perspective);
        return perspective;
      },
    },
    React: {
      Component,
      createElement() {},
    },
    WorkspaceStore: {Location: {RootSidebar: 'root-sidebar'}},
  };
  const smartFolderStore = {
    activate() {},
    deactivate() {
      state.storeDeactivations += 1;
    },
  };

  clearLibraryModules();
  Module._load = function loadWithFakes(request, parent, isMain) {
    if (request === 'mailspring-exports') {
      return mailspringExports;
    }
    if (request === './smart-folders-sidebar') {
      return SmartFoldersSidebar;
    }
    if (request === './smart-folder-store') {
      return {smartFolderStore};
    }
    if (request === './smart-folder-perspective') {
      return {
        SmartFolderPerspective,
        isSmartFolderPerspective(perspective) {
          return perspective instanceof SmartFolderPerspective;
        },
      };
    }
    if (request === './smart-folder-visibility') {
      return {
        activateSmartFolderVisibility() {},
        deactivateSmartFolderVisibility() {
          state.smartFolderVisibilityDeactivations += 1;
        },
      };
    }
    if (request === './smart-folder-definitions') {
      return {
        resolveDefinition() {},
        snapshotSource() {},
        sourceKey() {},
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const editor = require('../lib/smart-folder-editor');
    const main = require('../lib/main');
    return {SmartFolderPerspective, SmartFoldersSidebar, editor, main, state};
  } finally {
    Module._load = originalLoad;
    clearLibraryModules();
  }
}

test('only closes a mounted Smart Folder editor and disposes its listeners', {concurrency: false}, () => {
  const {editor, state} = loadPlugin();
  const mountedEditor = new editor.SmartFolderEditor({definition: {sources: []}});

  editor.closeOpenSmartFolderEditor();
  assert.equal(state.closeModalCalls, 0);

  mountedEditor.componentDidMount();
  editor.closeOpenSmartFolderEditor();
  assert.equal(state.closeModalCalls, 1);

  mountedEditor.componentWillUnmount();
  editor.closeOpenSmartFolderEditor();
  assert.equal(state.closeModalCalls, 1);
  assert.equal(state.accountListenerDisposals, 1);
  assert.equal(state.categoryListenerDisposals, 1);
});

test('deactivation closes the mounted editor, unregisters the sidebar, and returns a Smart Folder to inbox', {concurrency: false}, () => {
  const {SmartFolderPerspective, SmartFoldersSidebar, editor, main, state} = loadPlugin();
  const mountedEditor = new editor.SmartFolderEditor({definition: {sources: []}});
  state.currentPerspective = new SmartFolderPerspective();
  mountedEditor.componentDidMount();

  main.deactivate();

  assert.equal(state.closeModalCalls, 1);
  assert.deepEqual(state.unregisteredComponents, [SmartFoldersSidebar]);
  assert.equal(state.focusedPerspectives.length, 1);
  assert.equal(state.focusedPerspectives[0], state.inboxPerspectives[0]);
  assert.deepEqual(state.focusedPerspectives[0].accounts, [{id: 'account-a'}]);
  assert.equal(state.smartFolderVisibilityDeactivations, 1);
  assert.equal(state.storeDeactivations, 1);

  mountedEditor.componentWillUnmount();
});

test('deactivation leaves a non-Smart Folder perspective and modal untouched', {concurrency: false}, () => {
  const {SmartFoldersSidebar, main, state} = loadPlugin();
  const existingPerspective = {kind: 'search'};
  state.currentPerspective = existingPerspective;

  main.deactivate();

  assert.equal(state.closeModalCalls, 0);
  assert.deepEqual(state.unregisteredComponents, [SmartFoldersSidebar]);
  assert.deepEqual(state.focusedPerspectives, []);
  assert.equal(state.currentPerspective, existingPerspective);
  assert.equal(state.smartFolderVisibilityDeactivations, 1);
  assert.equal(state.storeDeactivations, 1);
});
