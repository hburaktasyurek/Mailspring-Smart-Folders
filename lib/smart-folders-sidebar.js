const path = require('path');

const {
  Actions,
  AccountStore,
  CategoryStore,
  FocusedPerspectiveStore,
  MailboxPerspective,
  React,
  ReactDOM,
} = require('mailspring-exports');
const {RetinaImg} = require('mailspring-component-kit');

function resolveElectronRemote() {
  try {
    return require('@electron/remote');
  } catch (error) {
    if (
      !error ||
      error.code !== 'MODULE_NOT_FOUND' ||
      typeof error.message !== 'string' ||
      !error.message.startsWith("Cannot find module '@electron/remote'")
    ) {
      throw error;
    }

    return require(
      path.join(
        AppEnv.getLoadSettings().resourcePath,
        'node_modules',
        '@electron',
        'remote'
      )
    );
  }
}

const {Menu, MenuItem} = resolveElectronRemote();
const {resolveDefinition} = require('./smart-folder-definitions');
const {SmartFolderPerspective, isSmartFolderPerspective} = require('./smart-folder-perspective');
const {smartFolderStore} = require('./smart-folder-store');
const {openSmartFolderEditor} = require('./smart-folder-editor');

class SmartFoldersSidebar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {portalTarget: null, revision: 0};
    this._listeners = [];
    this._attachToAccountSidebar = this._attachToAccountSidebar.bind(this);
    this._onChanged = this._onChanged.bind(this);
    this._focusDefinition = this._focusDefinition.bind(this);
    this._onTreeKeyDown = this._onTreeKeyDown.bind(this);
  }

  componentDidMount() {
    this._listeners = [
      smartFolderStore.listen(this._onChanged),
      AccountStore.listen(this._onChanged),
      CategoryStore.listen(this._onChanged),
      FocusedPerspectiveStore.listen(this._onChanged),
    ];
    this._attachToAccountSidebar();
  }

  componentWillUnmount() {
    if (this._portalRetryFrame) {
      cancelAnimationFrame(this._portalRetryFrame);
      this._portalRetryFrame = null;
    }
    const portalTarget = this.state.portalTarget;
    if (portalTarget) {
      setTimeout(() => portalTarget.remove(), 0);
    }
    this._listeners.forEach((listener) => {
      if (listener && typeof listener.dispose === 'function') {
        listener.dispose();
      } else if (typeof listener === 'function') {
        listener();
      }
    });
    this._listeners = [];
  }

  _attachToAccountSidebar() {
    if (this.state.portalTarget && document.body.contains(this.state.portalTarget)) {
      return;
    }

    const candidates = Array.from(document.querySelectorAll('.account-sidebar-sections'));
    const sections =
      candidates.find((candidate) => candidate.getClientRects().length > 0) || candidates[0];

    if (!sections) {
      if (!this._portalRetryFrame) {
        this._portalRetryFrame = requestAnimationFrame(() => {
          this._portalRetryFrame = null;
          this._attachToAccountSidebar();
        });
      }
      return;
    }

    const portalTarget = document.createElement('div');
    portalTarget.className = 'smart-folders-sidebar-mount';
    sections.insertBefore(portalTarget, sections.children[1] || null);
    this.setState({portalTarget});
  }

  _onChanged() {
    this._attachToAccountSidebar();
    const perspective = FocusedPerspectiveStore.current();

    if (isSmartFolderPerspective(perspective)) {
      const definition = smartFolderStore.getById(perspective.definitionId);
      if (definition) {
        const desiredPerspective = new SmartFolderPerspective(definition);
        if (
          perspective.name !== desiredPerspective.name ||
          !perspective.isEqual(desiredPerspective)
        ) {
          Actions.focusMailboxPerspective(desiredPerspective);
        }
      } else {
        Actions.focusMailboxPerspective(
          MailboxPerspective.forInbox(AccountStore.accounts())
        );
      }
    }

    this.setState((state) => ({revision: state.revision + 1}));
  }

  _focusDefinition(definition) {
    Actions.focusMailboxPerspective(new SmartFolderPerspective(definition));
  }

  _deleteDefinition(definition) {
    if (!window.confirm(`Delete smart folder “${definition.name}”?`)) {
      return;
    }

    try {
      smartFolderStore.remove(definition.id);
    } catch (error) {
      AppEnv.showErrorDialog({
        title: 'Unable to Delete Smart Folder',
        message:
          error && typeof error.message === 'string' ? error.message : String(error),
      });
    }
  }

  _showActionsMenu(definitionId) {
    const menu = new Menu();
    menu.append(
      new MenuItem({
        label: 'Edit Smart Folder…',
        click: () => {
          const definition = smartFolderStore.getById(definitionId);
          if (definition) {
            openSmartFolderEditor(definition);
          }
        },
      })
    );
    menu.append(
      new MenuItem({
        label: 'Delete Smart Folder',
        click: () => {
          const definition = smartFolderStore.getById(definitionId);
          if (definition) {
            this._deleteDefinition(definition);
          }
        },
      })
    );

    menu.popup({});
  }

  _onTreeKeyDown(event) {
    const focused = event.target;
    if (!focused || focused.getAttribute('role') !== 'treeitem') {
      return;
    }

    const items = Array.from(event.currentTarget.querySelectorAll('[role="treeitem"]'));
    const currentIndex = items.indexOf(focused);
    let next = null;

    if (event.key === 'ArrowDown') {
      next = items[currentIndex + 1];
    } else if (event.key === 'ArrowUp') {
      next = items[currentIndex - 1];
    } else if (event.key === 'Home') {
      next = items[0];
    } else if (event.key === 'End') {
      next = items[items.length - 1];
    } else {
      return;
    }

    event.preventDefault();
    if (next) {
      focused.setAttribute('tabIndex', '-1');
      next.setAttribute('tabIndex', '0');
      next.focus();
    }
  }

  _renderDefinition(definition, isFirst) {
    const perspective = FocusedPerspectiveStore.current();
    const selected =
      isSmartFolderPerspective(perspective) && perspective.definitionId === definition.id;
    const {missingSources} = resolveDefinition(definition);
    const missingSourceLabel = `${missingSources.length} source${
      missingSources.length === 1 ? '' : 's'
    } unavailable`;

    return React.createElement(
      'div',
      {
        'aria-label': missingSources.length
          ? `Smart Folders, ${definition.name}, ${missingSourceLabel}`
          : `Smart Folders, ${definition.name}`,
        'aria-selected': selected,
        'data-smart-folder-definition-id': definition.id,
        onClick: (event) => {
          event.currentTarget.focus();
          this._focusDefinition(definition);
        },
        onContextMenu: (event) => {
          event.currentTarget.focus();
          event.preventDefault();
          event.stopPropagation();
          this._showActionsMenu(definition.id);
        },
        onDoubleClick: () => openSmartFolderEditor(definition),
        onKeyDown: (event) => {
          if (event.target !== event.currentTarget) {
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this._focusDefinition(definition);
          }
        },
        role: 'treeitem',
        tabIndex: selected || isFirst ? 0 : -1,
      },
      React.createElement(
        'span',
        {className: 'item-container'},
        React.createElement(
          'div',
          {className: `item${selected ? ' selected' : ''}`},
          React.createElement(
            'div',
            {className: 'icon'},
            React.createElement(RetinaImg, {
              fallback: 'folder.png',
              mode: RetinaImg.Mode.ContentIsMask,
              name: 'folder.png',
            })
          ),
          React.createElement(
            'div',
            {className: 'name', title: definition.name},
            definition.name
          ),
          missingSources.length
            ? React.createElement(
                'span',
                {
                  'aria-label': missingSourceLabel,
                  className: 'smart-folders-sidebar-warning',
                  role: 'status',
                  title: missingSourceLabel,
                },
                React.createElement(RetinaImg, {
                  mode: RetinaImg.Mode.ContentPreserve,
                  name: 'tiny-warning-sign.png',
                })
              )
            : null,
          React.createElement(
            'button',
            {
              'aria-label': `Actions for ${definition.name}`,
              className: 'item-action-button',
              onClick: (event) => {
                event.stopPropagation();
                this._showActionsMenu(definition.id);
              },
              onDoubleClick: (event) => event.stopPropagation(),
              onKeyDown: (event) => event.stopPropagation(),
              title: `Actions for ${definition.name}`,
              type: 'button',
            },
            '•••'
          )
        )
      )
    );
  }

  render() {
    const definitions = smartFolderStore.getAll();
    const perspective = FocusedPerspectiveStore.current();
    const hasSelectedDefinition = isSmartFolderPerspective(perspective);

    const section = React.createElement(
      'section',
      {
        'aria-labelledby': 'smart-folders-sidebar-heading',
        className: 'smart-folders-sidebar outline-view nylas-outline-view',
      },
      React.createElement(
        'div',
        {className: 'heading'},
        React.createElement(
          'span',
          {
            className: 'text',
            id: 'smart-folders-sidebar-heading',
            title: 'Smart Folders',
          },
          'Smart Folders'
        ),
        React.createElement(
          'span',
          {
            'aria-label': 'Add Smart Folder',
            className: 'add-item-button',
            onClick: () => openSmartFolderEditor(),
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openSmartFolderEditor();
              }
            },
            role: 'button',
            tabIndex: 0,
            title: 'Add Smart Folder',
          },
          React.createElement(RetinaImg, {
            mode: RetinaImg.Mode.ContentIsMask,
            style: {height: 15, width: 14},
            url: 'mailspring://account-sidebar/assets/icon-sidebar-addcategory@2x.png',
          })
        )
      ),
      React.createElement(
        'div',
        {
          'aria-label': 'Smart Folders',
          className: 'smart-folders-sidebar-tree',
          onKeyDown: this._onTreeKeyDown,
          role: 'tree',
        },
        definitions.length
          ? definitions.map((definition, index) =>
              this._renderDefinition(definition, !hasSelectedDefinition && index === 0)
            )
          : React.createElement(
              'div',
              {className: 'smart-folders-sidebar-empty'},
              'No smart folders yet.'
            )
      )
    );

    return this.state.portalTarget
      ? ReactDOM.createPortal(section, this.state.portalTarget)
      : null;
  }
}

SmartFoldersSidebar.displayName = 'SmartFoldersSidebar';
SmartFoldersSidebar.containerRequired = false;

module.exports = SmartFoldersSidebar;
