const {
  Actions,
  FocusedPerspectiveStore,
  MessageStore,
} = require('mailspring-exports');
const {isSmartFolderPerspective} = require('./smart-folder-perspective');

let active = false;
let stopListeningToPerspective = null;
let stopListeningToMessages = null;
let stopListeningToActions = null;
let revealTimer = null;
let visibleThreadId = null;
let revealedThreadId = null;
let pluginOwnedThreadId = null;
let togglingHiddenMessages = false;

function needsHiddenMessagesRevealed() {
  const perspective = FocusedPerspectiveStore.current();
  return (
    isSmartFolderPerspective(perspective) &&
    perspective.needsHiddenMessagesRevealed()
  );
}

function clearRevealTimer() {
  if (revealTimer !== null) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }
}

function toggleHiddenMessages() {
  togglingHiddenMessages = true;
  try {
    Actions.toggleHiddenMessages();
  } finally {
    togglingHiddenMessages = false;
  }
}

function restorePluginOwnedVisibility() {
  const threadId = MessageStore.threadId();
  if (!threadId || pluginOwnedThreadId !== threadId) {
    return;
  }

  pluginOwnedThreadId = null;
  toggleHiddenMessages();
}

function scheduleReveal() {
  clearRevealTimer();

  if (!active || !needsHiddenMessagesRevealed() || MessageStore.itemsLoading()) {
    return;
  }

  const threadId = MessageStore.threadId();
  if (!threadId || threadId === revealedThreadId) {
    return;
  }

  revealTimer = setTimeout(() => {
    revealTimer = null;

    if (!active || !needsHiddenMessagesRevealed() || MessageStore.itemsLoading()) {
      return;
    }
    if (MessageStore.threadId() !== threadId || revealedThreadId === threadId) {
      return;
    }
    if (MessageStore.numberOfHiddenItems() <= 0) {
      return;
    }

    revealedThreadId = threadId;
    pluginOwnedThreadId = threadId;
    toggleHiddenMessages();
  }, 0);
}

function onMessageStoreChanged() {
  const threadId = MessageStore.threadId();
  if (threadId !== visibleThreadId) {
    visibleThreadId = threadId;
    revealedThreadId = null;
    pluginOwnedThreadId = null;
  }
  scheduleReveal();
}

function onPerspectiveChanged() {
  if (!needsHiddenMessagesRevealed()) {
    restorePluginOwnedVisibility();
  }
  scheduleReveal();
}

function onHiddenMessagesToggled() {
  if (!togglingHiddenMessages && pluginOwnedThreadId === MessageStore.threadId()) {
    pluginOwnedThreadId = null;
  }
}

function activateSmartFolderVisibility() {
  if (active) {
    return;
  }

  active = true;
  stopListeningToPerspective = FocusedPerspectiveStore.listen(onPerspectiveChanged);
  stopListeningToMessages = MessageStore.listen(onMessageStoreChanged);
  stopListeningToActions = Actions.toggleHiddenMessages.listen(onHiddenMessagesToggled);
  onMessageStoreChanged();
}

function deactivateSmartFolderVisibility() {
  if (!active) {
    return;
  }

  active = false;
  clearRevealTimer();
  restorePluginOwnedVisibility();
  if (stopListeningToPerspective) {
    stopListeningToPerspective();
    stopListeningToPerspective = null;
  }
  if (stopListeningToMessages) {
    stopListeningToMessages();
    stopListeningToMessages = null;
  }
  if (stopListeningToActions) {
    stopListeningToActions();
    stopListeningToActions = null;
  }
  visibleThreadId = null;
  revealedThreadId = null;
  pluginOwnedThreadId = null;
}

module.exports = {
  activateSmartFolderVisibility,
  deactivateSmartFolderVisibility,
};
