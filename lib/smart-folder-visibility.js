const {
  Actions,
  FocusedPerspectiveStore,
  MessageStore,
} = require('mailspring-exports');
const {isSmartFolderPerspective} = require('./smart-folder-perspective');

let active = false;
let stopListeningToPerspective = null;
let stopListeningToMessages = null;
let revealTimer = null;
let visibleThreadId = null;
let revealedThreadId = null;

function currentMixedPerspective() {
  const perspective = FocusedPerspectiveStore.current();
  return (
    isSmartFolderPerspective(perspective) &&
    perspective.hasMixedHiddenCategories() &&
    perspective
  );
}

function clearRevealTimer() {
  if (revealTimer !== null) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }
}

function scheduleReveal() {
  clearRevealTimer();

  if (!active || !currentMixedPerspective() || MessageStore.itemsLoading()) {
    return;
  }

  const threadId = MessageStore.threadId();
  if (!threadId || threadId === revealedThreadId) {
    return;
  }

  revealTimer = setTimeout(() => {
    revealTimer = null;

    if (!active || !currentMixedPerspective() || MessageStore.itemsLoading()) {
      return;
    }
    if (MessageStore.threadId() !== threadId || revealedThreadId === threadId) {
      return;
    }
    if (MessageStore.numberOfHiddenItems() <= 0) {
      return;
    }

    revealedThreadId = threadId;
    Actions.toggleHiddenMessages();
  }, 0);
}

function onMessageStoreChanged() {
  const threadId = MessageStore.threadId();
  if (threadId !== visibleThreadId) {
    visibleThreadId = threadId;
    revealedThreadId = null;
  }
  scheduleReveal();
}

function onPerspectiveChanged() {
  revealedThreadId = null;
  scheduleReveal();
}

function activateMixedVisibility() {
  if (active) {
    return;
  }

  active = true;
  stopListeningToPerspective = FocusedPerspectiveStore.listen(onPerspectiveChanged);
  stopListeningToMessages = MessageStore.listen(onMessageStoreChanged);
  onMessageStoreChanged();
}

function deactivateMixedVisibility() {
  if (!active) {
    return;
  }

  active = false;
  clearRevealTimer();
  if (stopListeningToPerspective) {
    stopListeningToPerspective();
    stopListeningToPerspective = null;
  }
  if (stopListeningToMessages) {
    stopListeningToMessages();
    stopListeningToMessages = null;
  }
  visibleThreadId = null;
  revealedThreadId = null;
}

module.exports = {
  activateMixedVisibility,
  deactivateMixedVisibility,
};
