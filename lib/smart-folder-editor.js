const {
  AccountStore,
  Actions,
  CategoryStore,
  React,
  RegExpUtils,
} = require('mailspring-exports');
const {buildCategoryTree} = require('./category-tree');
const {
  resolveDefinition,
  snapshotSource,
  sourceKey,
} = require('./smart-folder-definitions');
const {smartFolderStore} = require('./smart-folder-store');

let mountedSmartFolderEditorCount = 0;

function accountLabel(account) {
  return account.label || account.emailAddress || account.id;
}

function sourceLabel(source) {
  const account = source.accountName || source.accountId;
  const category = source.categoryName || source.categoryId;

  return `${account} — ${category}`;
}

function validationErrors(name, sources) {
  const errors = [];

  if (!name.trim()) {
    errors.push('Enter a name for this smart folder.');
  }
  if (!sources.length) {
    errors.push('Select at least one source folder.');
  }

  return errors;
}

class SmartFolderEditor extends React.Component {
  constructor(props) {
    super(props);

    const definition = props.definition || {};
    this.state = {
      error: null,
      name: definition.name || '',
      saving: false,
      sources: (definition.sources || []).slice(),
      storeRevision: 0,
    };

    this._onStoresChanged = this._onStoresChanged.bind(this);
    this._onNameChanged = this._onNameChanged.bind(this);
    this._toggleSource = this._toggleSource.bind(this);
    this._removeSource = this._removeSource.bind(this);
    this._save = this._save.bind(this);
    this._close = this._close.bind(this);
  }

  componentDidMount() {
    if (!this._isMounted) {
      mountedSmartFolderEditorCount += 1;
      this._isMounted = true;
    }
    this._unlistenAccountStore = AccountStore.listen(this._onStoresChanged);
    this._unlistenCategoryStore = CategoryStore.listen(this._onStoresChanged);
  }

  componentWillUnmount() {
    if (this._isMounted) {
      mountedSmartFolderEditorCount -= 1;
      this._isMounted = false;
    }
    if (this._unlistenAccountStore) {
      this._unlistenAccountStore();
      this._unlistenAccountStore = null;
    }
    if (this._unlistenCategoryStore) {
      this._unlistenCategoryStore();
      this._unlistenCategoryStore = null;
    }
  }

  _onStoresChanged() {
    this.setState((state) => ({storeRevision: state.storeRevision + 1}));
  }

  _onNameChanged(event) {
    this.setState({error: null, name: event.target.value});
  }

  _toggleSource(account, category) {
    const source = {
      accountId: account.id,
      categoryId: category.id,
    };
    const key = sourceKey(source);

    this.setState((state) => {
      const selected = state.sources.some((candidate) => sourceKey(candidate) === key);

      return {
        error: null,
        sources: selected
          ? state.sources.filter((candidate) => sourceKey(candidate) !== key)
          : state.sources.concat([snapshotSource(account, category)]),
      };
    });
  }

  _removeSource(source) {
    const key = sourceKey(source);

    this.setState((state) => ({
      error: null,
      sources: state.sources.filter((candidate) => sourceKey(candidate) !== key),
    }));
  }

  _sourcesWithVisibleSnapshots() {
    const accountsById = Object.create(null);
    AccountStore.accounts().forEach((account) => {
      accountsById[account.id] = account;
    });

    return this.state.sources.map((source) => {
      const account = accountsById[source.accountId];
      const category = account && CategoryStore.byId(source.accountId, source.categoryId);

      return category ? snapshotSource(account, category) : source;
    });
  }

  async _save(event) {
    if (event) {
      event.preventDefault();
    }
    if (this.state.saving) {
      return;
    }

    const errors = validationErrors(this.state.name, this.state.sources);
    if (errors.length) {
      this.setState({error: errors[0]});
      return;
    }

    const definition = {
      name: this.state.name.trim(),
      sources: this._sourcesWithVisibleSnapshots(),
    };

    this.setState({error: null, saving: true});
    try {
      if (this.props.definition) {
        await smartFolderStore.update(this.props.definition.id, definition);
      } else {
        await smartFolderStore.create(definition);
      }
      Actions.closeModal();
    } catch (error) {
      this.setState({
        error: error && error.message ? error.message : String(error),
        saving: false,
      });
    }
  }

  _close() {
    Actions.closeModal();
  }

  _renderCategory(account, node) {
    const source = {
      accountId: account.id,
      categoryId: node.category.id,
    };
    const key = sourceKey(source);
    const checked = this.state.sources.some((candidate) => sourceKey(candidate) === key);
    const sourceLabelText = `${accountLabel(account)} — ${node.label}`;

    return React.createElement(
      'div',
      {className: 'smart-folder-editor-category-group', key},
      React.createElement(
        'label',
        {className: 'smart-folder-editor-category', title: node.label},
        React.createElement('input', {
          'aria-label': sourceLabelText,
          checked,
          'data-account-id': source.accountId,
          'data-category-id': source.categoryId,
          onChange: () => this._toggleSource(account, node.category),
          type: 'checkbox',
        }),
        React.createElement('span', null, node.label)
      ),
      node.children.length
        ? React.createElement(
            'div',
            {className: 'smart-folder-editor-category-children'},
            node.children.map((child) => this._renderCategory(account, child))
          )
        : null
    );
  }

  _renderAccount(account, splitRegex) {
    const categories = CategoryStore.categories(account.id) || [];
    const tree = buildCategoryTree(categories, splitRegex);

    return React.createElement(
      'section',
      {className: 'smart-folder-editor-account', key: account.id},
      React.createElement(
        'h6',
        {className: 'smart-folder-editor-account-name'},
        accountLabel(account)
      ),
      tree.length
        ? tree.map((node) => this._renderCategory(account, node))
        : React.createElement(
            'div',
            {className: 'smart-folder-editor-no-categories'},
            'No folders available for this account.'
          )
    );
  }

  _renderMissingSources(sources) {
    if (!sources.length) {
      return null;
    }

    return React.createElement(
      'section',
      {className: 'smart-folder-editor-missing-sources'},
      React.createElement('h6', null, 'Unavailable selected folders'),
      React.createElement(
        'p',
        null,
        'These folders remain selected and will be used again if they become available.'
      ),
      React.createElement(
        'ul',
        null,
        sources.map((source) =>
          React.createElement(
            'li',
            {key: sourceKey(source)},
            React.createElement('span', {title: sourceLabel(source)}, sourceLabel(source)),
            React.createElement(
              'button',
              {
                'aria-label': `Remove unavailable folder ${sourceLabel(source)}`,
                className: 'btn btn-small',
                onClick: () => this._removeSource(source),
                type: 'button',
              },
              'Remove'
            )
          )
        )
      )
    );
  }

  render() {
    const accounts = AccountStore.accounts();
    const {missingSources} = resolveDefinition({sources: this.state.sources});
    const errors = validationErrors(this.state.name, this.state.sources);
    const visibleErrors = this.state.error
      ? this.state.error && errors.indexOf(this.state.error) === -1
        ? [this.state.error].concat(errors)
        : errors
      : [];
    const editing = Boolean(this.props.definition);
    const hasNameError = visibleErrors.indexOf('Enter a name for this smart folder.') !== -1;
    const hasSourceError =
      visibleErrors.indexOf('Select at least one source folder.') !== -1;

    return React.createElement(
      'form',
      {className: 'smart-folder-editor', onSubmit: this._save},
      React.createElement(
        'header',
        {className: 'smart-folder-editor-header'},
        React.createElement(
          'h2',
          {className: 'smart-folder-editor-title'},
          editing ? 'Edit Smart Folder' : 'New Smart Folder'
        ),
        React.createElement(
          'p',
          null,
          'Messages from the selected folders will appear together in this smart folder.'
        )
      ),
      React.createElement(
        'div',
        {className: 'smart-folder-editor-name'},
        React.createElement('label', {htmlFor: 'smart-folder-editor-name'}, 'Name'),
        React.createElement('input', {
          'aria-describedby': visibleErrors.length ? 'smart-folder-editor-errors' : undefined,
          'aria-invalid': hasNameError,
          autoFocus: true,
          id: 'smart-folder-editor-name',
          onChange: this._onNameChanged,
          type: 'text',
          value: this.state.name,
        })
      ),
      visibleErrors.length
        ? React.createElement(
            'div',
            {
              className: 'smart-folder-editor-error',
              id: 'smart-folder-editor-errors',
              role: 'alert',
            },
            visibleErrors.map((message) =>
              React.createElement('div', {key: message}, message)
            )
          )
        : null,
      React.createElement(
        'section',
        {
          'aria-labelledby': 'smart-folder-editor-sources-heading',
          className: 'smart-folder-editor-sources',
        },
        React.createElement(
          'header',
          {className: 'smart-folder-editor-sources-header'},
          React.createElement(
            'h6',
            {id: 'smart-folder-editor-sources-heading'},
            'Source folders'
          ),
          React.createElement(
            'p',
            null,
            'Choose the folders whose messages should appear here.'
          )
        ),
        React.createElement(
          'div',
          {
            'aria-invalid': hasSourceError,
            'aria-label': 'Available source folders',
            className: 'smart-folder-editor-source-scroll',
            role: 'group',
          },
          accounts.length
            ? accounts.map((account) =>
                this._renderAccount(account, RegExpUtils.subcategorySplitRegex())
              )
            : React.createElement(
                'div',
                {className: 'smart-folder-editor-no-accounts'},
                'No accounts are available.'
              ),
          this._renderMissingSources(missingSources)
        )
      ),
      React.createElement(
        'footer',
        {className: 'smart-folder-editor-actions'},
        React.createElement(
          'button',
          {className: 'btn', onClick: this._close, type: 'button'},
          'Cancel'
        ),
        React.createElement(
          'button',
          {
            className: 'btn btn-primary',
            disabled: this.state.saving,
            type: 'submit',
          },
          this.state.saving ? 'Saving…' : 'Save'
        )
      )
    );
  }
}

SmartFolderEditor.displayName = 'SmartFolderEditor';

function closeOpenSmartFolderEditor() {
  if (mountedSmartFolderEditorCount > 0) {
    Actions.closeModal();
  }
}

function openSmartFolderEditor(definition) {
  Actions.openModal({
    component: React.createElement(SmartFolderEditor, {definition}),
    height: 560,
    width: 620,
  });
}

module.exports = {
  SmartFolderEditor,
  closeOpenSmartFolderEditor,
  openSmartFolderEditor,
};
