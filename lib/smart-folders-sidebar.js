const {
  Actions,
  AccountStore,
  CategoryStore,
  FocusedPerspectiveStore,
  MailboxPerspective,
  React,
} = require('mailspring-exports');
const {resolveDefinition} = require('./smart-folder-definitions');
const {SmartFolderPerspective, isSmartFolderPerspective} = require('./smart-folder-perspective');
const {smartFolderStore} = require('./smart-folder-store');
const {openSmartFolderEditor} = require('./smart-folder-editor');

class SmartFoldersSidebar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {revision: 0};
    this._onChanged = this._onChanged.bind(this);
    this._focusDefinition = this._focusDefinition.bind(this);
  }

  componentDidMount() {
    this._listeners = [
      smartFolderStore.listen(this._onChanged),
      AccountStore.listen(this._onChanged),
      CategoryStore.listen(this._onChanged),
      FocusedPerspectiveStore.listen(this._onChanged),
    ];
  }

  componentWillUnmount() {
    this._listeners.forEach((listener) => {
      if (listener && typeof listener.dispose === 'function') {
        listener.dispose();
      } else if (typeof listener === 'function') {
        listener();
      }
    });
    this._listeners = [];
  }

  _onChanged() {
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
        Actions.focusMailboxPerspective(MailboxPerspective.forNothing());
      }
    }

    this.setState((state) => ({revision: state.revision + 1}));
  }

  _focusDefinition(definition) {
    Actions.focusMailboxPerspective(new SmartFolderPerspective(definition));
  }

  _deleteDefinition(definition) {
    if (window.confirm(`Delete smart folder “${definition.name}”?`)) {
      smartFolderStore.remove(definition.id);
    }
  }

  _renderDefinition(definition) {
    const perspective = FocusedPerspectiveStore.current();
    const selected =
      isSmartFolderPerspective(perspective) && perspective.definitionId === definition.id;
    const {missingSources} = resolveDefinition(definition);
    const rowClassName = `smart-folders-sidebar-row${selected ? ' is-selected' : ''}`;
    const keyDown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this._focusDefinition(definition);
      }
    };

    return React.createElement(
      'div',
      {
        className: rowClassName,
        key: definition.id,
        role: 'button',
        tabIndex: 0,
        onClick: () => this._focusDefinition(definition),
        onKeyDown: keyDown,
      },
      React.createElement(
        'span',
        {className: 'smart-folders-sidebar-name', title: definition.name},
        definition.name
      ),
      missingSources.length
        ? React.createElement(
            'span',
            {
              className: 'smart-folders-sidebar-warning',
              title: `${missingSources.length} source${
                missingSources.length === 1 ? '' : 's'
              } unavailable`,
              'aria-label': `${missingSources.length} source${
                missingSources.length === 1 ? '' : 's'
              } unavailable`,
              role: 'status',
            },
            '!'
          )
        : null,
      React.createElement(
        'button',
        {
          className: 'btn btn-small smart-folders-sidebar-action',
          type: 'button',
          onClick: (event) => {
            event.stopPropagation();
            openSmartFolderEditor(definition);
          },
          onKeyDown: (event) => event.stopPropagation(),
        },
        'Edit'
      ),
      React.createElement(
        'button',
        {
          className: 'btn btn-small smart-folders-sidebar-action',
          type: 'button',
          onClick: (event) => {
            event.stopPropagation();
            this._deleteDefinition(definition);
          },
          onKeyDown: (event) => event.stopPropagation(),
        },
        'Delete'
      )
    );
  }

  render() {
    const definitions = smartFolderStore.getAll();

    return React.createElement(
      'section',
      {className: 'smart-folders-sidebar'},
      React.createElement(
        'div',
        {className: 'smart-folders-sidebar-header'},
        React.createElement('h2', null, 'Smart Folders'),
        React.createElement(
          'button',
          {
            className: 'btn btn-small smart-folders-sidebar-add',
            type: 'button',
            onClick: () => openSmartFolderEditor(),
          },
          'Add'
        )
      ),
      definitions.length
        ? React.createElement(
            'div',
            {className: 'smart-folders-sidebar-list'},
            definitions.map((definition) => this._renderDefinition(definition))
          )
        : React.createElement(
            'div',
            {className: 'smart-folders-sidebar-empty'},
            'No smart folders yet.'
          )
    );
  }
}

SmartFoldersSidebar.displayName = 'SmartFoldersSidebar';
SmartFoldersSidebar.containerRequired = false;

module.exports = SmartFoldersSidebar;
