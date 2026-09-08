const {
  AccountStore,
  Actions,
  ComponentRegistry,
  FocusedPerspectiveStore,
  MailboxPerspective,
  WorkspaceStore,
} = require('mailspring-exports');
const SmartFoldersSidebar = require('./smart-folders-sidebar');
const {closeOpenSmartFolderEditor} = require('./smart-folder-editor');
const {smartFolderStore} = require('./smart-folder-store');
const {isSmartFolderPerspective} = require('./smart-folder-perspective');
const {
  activateMixedVisibility,
  deactivateMixedVisibility,
} = require('./smart-folder-visibility');

function activate() {
  smartFolderStore.activate();
  activateMixedVisibility();
  ComponentRegistry.register(SmartFoldersSidebar, {
    location: WorkspaceStore.Location.RootSidebar,
  });
}

function deactivate() {
  closeOpenSmartFolderEditor();
  ComponentRegistry.unregister(SmartFoldersSidebar);

  if (isSmartFolderPerspective(FocusedPerspectiveStore.current())) {
    Actions.focusMailboxPerspective(MailboxPerspective.forInbox(AccountStore.accounts()));
  }

  deactivateMixedVisibility();
  smartFolderStore.deactivate();
}

const config = {
  definitions: {
    type: 'array',
    default: [],
  },
};

module.exports = {activate, deactivate, config};
