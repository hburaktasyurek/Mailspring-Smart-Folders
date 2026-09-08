const {CONFIG_KEY, normalizeDefinitions} = require('./smart-folder-definitions');

let nextId = 0;

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function definitionFromAttributes(id, attributes) {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    throw new Error('A smart folder requires a name and at least one source.');
  }
  if (!hasText(attributes.name)) {
    throw new Error('A smart folder name is required.');
  }
  if (!Array.isArray(attributes.sources)) {
    throw new Error('A smart folder requires at least one source.');
  }

  const definitions = normalizeDefinitions([{
    id,
    name: attributes.name.trim(),
    sources: attributes.sources,
  }]);
  if (!definitions.length) {
    throw new Error('A smart folder requires at least one valid source.');
  }
  return definitions[0];
}

function generateId(definitions) {
  const existingIds = new Set(definitions.map((definition) => definition.id));
  let id;

  do {
    id = `smart-folder-${Date.now().toString(36)}-${(nextId += 1).toString(36)}`;
  } while (existingIds.has(id));

  return id;
}

class SmartFolderStore {
  constructor() {
    this._configSubscription = null;
    this._listeners = new Set();
    this._onDefinitionsChanged = this._onDefinitionsChanged.bind(this);
  }

  activate() {
    if (this._configSubscription) {
      return;
    }
    this._configSubscription = AppEnv.config.onDidChange(
      CONFIG_KEY,
      this._onDefinitionsChanged
    );
  }

  deactivate() {
    const subscription = this._configSubscription;
    this._configSubscription = null;
    try {
      if (subscription) {
        subscription.dispose();
      }
    } finally {
      this._listeners.clear();
    }
  }

  listen(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Smart folder listeners must be functions.');
    }

    this._listeners.add(listener);
    return {
      dispose: () => this._listeners.delete(listener),
    };
  }

  getAll() {
    return normalizeDefinitions(AppEnv.config.get(CONFIG_KEY));
  }

  getById(id) {
    return this.getAll().find((definition) => definition.id === id) || null;
  }

  create(attributes) {
    const definitions = this.getAll();
    const definition = definitionFromAttributes(generateId(definitions), attributes);
    this._write(definitions.concat([definition]));
    return definition;
  }

  update(id, attributes) {
    const definitions = this.getAll();
    const current = definitions.find((definition) => definition.id === id);
    if (!current) {
      throw new Error('Smart folder not found.');
    }

    const definition = definitionFromAttributes(id, {
      name: attributes && attributes.name,
      sources: attributes && attributes.sources,
    });
    const updated = definitions.map((candidate) => (
      candidate.id === id ? definition : candidate
    ));
    this._write(updated);
    return definition;
  }

  remove(id) {
    const definitions = this.getAll();
    const definition = definitions.find((candidate) => candidate.id === id);
    if (!definition) {
      throw new Error('Smart folder not found.');
    }

    this._write(definitions.filter((candidate) => candidate.id !== id));
    return definition;
  }

  _write(definitions) {
    if (AppEnv.config.set(CONFIG_KEY, definitions) === false) {
      throw new Error('Unable to save smart folder definitions.');
    }
  }

  _onDefinitionsChanged() {
    this._listeners.forEach((listener) => listener());
  }
}

const smartFolderStore = new SmartFolderStore();

module.exports = {SmartFolderStore, smartFolderStore};
