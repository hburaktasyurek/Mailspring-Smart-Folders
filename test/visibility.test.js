'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const LIBRARY_DIRECTORY = `${__dirname.slice(0, __dirname.lastIndexOf('/'))}/lib/`;

function clearLibraryModules() {
  Object.keys(require.cache).forEach((modulePath) => {
    if (modulePath.startsWith(LIBRARY_DIRECTORY)) {
      delete require.cache[modulePath];
    }
  });
}

function loadVisibility() {
  const originalLoad = Module._load;
  const nativeSetTimeout = global.setTimeout;
  const nativeClearTimeout = global.clearTimeout;
  const state = {
    actionListeners: new Set(),
    actionListenerDisposals: 0,
    defaultHiddenRoles: ['spam', 'trash'],
    hiddenItemCount: 1,
    hiddenMessagesVisible: false,
    itemsLoading: false,
    messageListeners: new Set(),
    messageListenerDisposals: 0,
    nextTimerId: 1,
    perspectiveListeners: new Set(),
    perspectiveListenerDisposals: 0,
    currentPerspective: null,
    threadId: 'thread-a',
    timers: new Map(),
    toggleHiddenMessagesCalls: 0,
  };

  class SmartFolderPerspective {
    constructor(categories) {
      this.categories = categories;
    }

    needsHiddenMessagesRevealed() {
      return (
        this.categories.some((category) =>
          state.defaultHiddenRoles.includes(category.role)
        ) &&
        !this.categories.every((category) => category.role === 'spam') &&
        !this.categories.every((category) => category.role === 'trash')
      );
    }
  }

  state.smartPerspective = (roles) =>
    new SmartFolderPerspective(roles.map((role) => ({role})));
  state.emitMessageChange = () => {
    [...state.messageListeners].forEach((listener) => listener());
  };
  state.emitPerspectiveChange = () => {
    [...state.perspectiveListeners].forEach((listener) => listener());
  };
  state.runTimers = () => {
    const callbacks = [...state.timers.values()];
    state.timers.clear();
    callbacks.forEach((callback) => callback());
  };

  global.setTimeout = (callback) => {
    const timerId = state.nextTimerId;
    state.nextTimerId += 1;
    state.timers.set(timerId, callback);
    return timerId;
  };
  global.clearTimeout = (timerId) => {
    state.timers.delete(timerId);
  };

  const toggleHiddenMessages = () => {
    state.toggleHiddenMessagesCalls += 1;
    state.hiddenMessagesVisible = !state.hiddenMessagesVisible;
    [...state.actionListeners].forEach((listener) => listener());
  };
  toggleHiddenMessages.listen = (listener) => {
    state.actionListeners.add(listener);
    return () => {
      if (state.actionListeners.delete(listener)) {
        state.actionListenerDisposals += 1;
      }
    };
  };
  state.userToggleHiddenMessages = toggleHiddenMessages;

  const mailspringExports = {
    Actions: {
      toggleHiddenMessages,
    },
    FocusedPerspectiveStore: {
      current() {
        return state.currentPerspective;
      },
      listen(listener) {
        state.perspectiveListeners.add(listener);
        return () => {
          if (state.perspectiveListeners.delete(listener)) {
            state.perspectiveListenerDisposals += 1;
          }
        };
      },
    },
    MessageStore: {
      FolderNamesHiddenByDefault: state.defaultHiddenRoles,
      itemsLoading() {
        return state.itemsLoading;
      },
      listen(listener) {
        state.messageListeners.add(listener);
        return () => {
          if (state.messageListeners.delete(listener)) {
            state.messageListenerDisposals += 1;
          }
        };
      },
      numberOfHiddenItems() {
        return state.hiddenItemCount;
      },
      threadId() {
        return state.threadId;
      },
    },
  };

  clearLibraryModules();
  Module._load = function loadWithFakes(request, parent, isMain) {
    if (request === 'mailspring-exports') {
      return mailspringExports;
    }
    if (request === './smart-folder-perspective') {
      return {
        isSmartFolderPerspective(perspective) {
          return perspective instanceof SmartFolderPerspective;
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return {
      state,
      visibility: require('../lib/smart-folder-visibility'),
      restore() {
        global.setTimeout = nativeSetTimeout;
        global.clearTimeout = nativeClearTimeout;
        clearLibraryModules();
      },
    };
  } catch (error) {
    global.setTimeout = nativeSetTimeout;
    global.clearTimeout = nativeClearTimeout;
    clearLibraryModules();
    throw error;
  } finally {
    Module._load = originalLoad;
  }
}

function withVisibility(run) {
  const harness = loadVisibility();
  try {
    return run(harness);
  } finally {
    harness.visibility.deactivateSmartFolderVisibility();
    harness.restore();
  }
}

test('does not schedule auto-reveal for smart folders without default-hidden sources', {concurrency: false}, () => {
  withVisibility(({state, visibility}) => {
    state.currentPerspective = state.smartPerspective(['inbox', 'sent']);

    visibility.activateSmartFolderVisibility();

    assert.equal(state.timers.size, 0);
    assert.equal(state.toggleHiddenMessagesCalls, 0);
  });
});

test('does not schedule auto-reveal for same-role spam sources', {concurrency: false}, () => {
  withVisibility(({state, visibility}) => {
    state.currentPerspective = state.smartPerspective(['spam', 'spam']);

    visibility.activateSmartFolderVisibility();

    assert.equal(state.timers.size, 0);
    assert.equal(state.toggleHiddenMessagesCalls, 0);
  });
});

test('auto-reveals a loaded normal and spam smart folder thread', {concurrency: false}, () => {
  withVisibility(({state, visibility}) => {
    state.currentPerspective = state.smartPerspective(['inbox', 'spam']);

    visibility.activateSmartFolderVisibility();
    assert.equal(state.timers.size, 1);

    state.runTimers();
    assert.equal(state.toggleHiddenMessagesCalls, 1);
    assert.equal(state.hiddenMessagesVisible, true);
  });
});

test('auto-reveals a loaded spam and trash smart folder thread', {concurrency: false}, () => {
  withVisibility(({state, visibility}) => {
    state.currentPerspective = state.smartPerspective(['spam', 'trash']);

    visibility.activateSmartFolderVisibility();
    assert.equal(state.timers.size, 1);

    state.runTimers();
    assert.equal(state.toggleHiddenMessagesCalls, 1);
    assert.equal(state.hiddenMessagesVisible, true);
  });
});

test('does not toggle when hidden items disappear before the scheduled callback', {concurrency: false}, () => {
  withVisibility(({state, visibility}) => {
    state.currentPerspective = state.smartPerspective(['inbox', 'spam']);

    visibility.activateSmartFolderVisibility();
    assert.equal(state.timers.size, 1);

    state.hiddenItemCount = 0;
    state.runTimers();
    assert.equal(state.toggleHiddenMessagesCalls, 0);
  });
});

test('waits for the focused thread to finish loading before auto-revealing it', {concurrency: false}, () => {
  withVisibility(({state, visibility}) => {
    state.currentPerspective = state.smartPerspective(['inbox', 'spam']);
    state.itemsLoading = true;

    visibility.activateSmartFolderVisibility();
    assert.equal(state.timers.size, 0);

    state.itemsLoading = false;
    state.emitMessageChange();
    assert.equal(state.timers.size, 1);

    state.runTimers();
    assert.equal(state.toggleHiddenMessagesCalls, 1);
  });
});

test('auto-reveals a focused thread at most once', {concurrency: false}, () => {
  withVisibility(({state, visibility}) => {
    state.currentPerspective = state.smartPerspective(['inbox', 'spam']);

    visibility.activateSmartFolderVisibility();
    state.runTimers();
    assert.equal(state.toggleHiddenMessagesCalls, 1);

    state.emitMessageChange();
    state.emitPerspectiveChange();
    assert.equal(state.timers.size, 0);

    state.runTimers();
    assert.equal(state.toggleHiddenMessagesCalls, 1);
  });
});

test('discards a scheduled reveal when focus changes to another thread', {concurrency: false}, () => {
  withVisibility(({state, visibility}) => {
    state.currentPerspective = state.smartPerspective(['inbox', 'spam']);

    visibility.activateSmartFolderVisibility();
    state.threadId = 'thread-b';
    state.runTimers();

    assert.equal(state.toggleHiddenMessagesCalls, 0);
  });
});

test('restores plugin-owned visibility once when leaving for a native perspective', {concurrency: false}, () => {
  withVisibility(({state, visibility}) => {
    state.currentPerspective = state.smartPerspective(['inbox', 'spam']);
    visibility.activateSmartFolderVisibility();
    state.runTimers();

    state.currentPerspective = {};
    state.emitPerspectiveChange();

    assert.equal(state.toggleHiddenMessagesCalls, 2);
    assert.equal(state.hiddenMessagesVisible, false);

    state.emitPerspectiveChange();
    assert.equal(state.toggleHiddenMessagesCalls, 2);
  });
});

test('restores plugin-owned visibility once when leaving for a non-applicable smart folder', {concurrency: false}, () => {
  withVisibility(({state, visibility}) => {
    state.currentPerspective = state.smartPerspective(['inbox', 'spam']);
    visibility.activateSmartFolderVisibility();
    state.runTimers();

    state.currentPerspective = state.smartPerspective(['inbox', 'sent']);
    state.emitPerspectiveChange();

    assert.equal(state.toggleHiddenMessagesCalls, 2);
    assert.equal(state.hiddenMessagesVisible, false);

    state.emitPerspectiveChange();
    assert.equal(state.toggleHiddenMessagesCalls, 2);
  });
});

test('does not invert visibility after a user toggle following auto-reveal', {concurrency: false}, () => {
  withVisibility(({state, visibility}) => {
    state.currentPerspective = state.smartPerspective(['inbox', 'spam']);
    visibility.activateSmartFolderVisibility();
    state.runTimers();

    state.userToggleHiddenMessages();
    assert.equal(state.toggleHiddenMessagesCalls, 2);
    assert.equal(state.hiddenMessagesVisible, false);

    state.currentPerspective = {};
    state.emitPerspectiveChange();

    assert.equal(state.toggleHiddenMessagesCalls, 2);
    assert.equal(state.hiddenMessagesVisible, false);
  });
});

test('deactivation restores plugin-owned visibility and disposes every listener', {concurrency: false}, () => {
  withVisibility(({state, visibility}) => {
    state.currentPerspective = state.smartPerspective(['inbox', 'spam']);

    visibility.activateSmartFolderVisibility();
    state.runTimers();
    assert.equal(state.toggleHiddenMessagesCalls, 1);
    assert.equal(state.hiddenMessagesVisible, true);

    visibility.deactivateSmartFolderVisibility();

    assert.equal(state.perspectiveListeners.size, 0);
    assert.equal(state.messageListeners.size, 0);
    assert.equal(state.actionListeners.size, 0);
    assert.equal(state.perspectiveListenerDisposals, 1);
    assert.equal(state.messageListenerDisposals, 1);
    assert.equal(state.actionListenerDisposals, 1);
    assert.equal(state.timers.size, 0);
    assert.equal(state.toggleHiddenMessagesCalls, 2);
    assert.equal(state.hiddenMessagesVisible, false);

    visibility.deactivateSmartFolderVisibility();
    assert.equal(state.toggleHiddenMessagesCalls, 2);
  });
});

test('deactivation removes scheduled reveals without toggling visibility', {concurrency: false}, () => {
  withVisibility(({state, visibility}) => {
    state.currentPerspective = state.smartPerspective(['inbox', 'spam']);

    visibility.activateSmartFolderVisibility();
    assert.equal(state.timers.size, 1);

    visibility.deactivateSmartFolderVisibility();

    assert.equal(state.actionListeners.size, 0);
    assert.equal(state.timers.size, 0);

    state.runTimers();
    assert.equal(state.toggleHiddenMessagesCalls, 0);
  });
});
