const {CategoryStore} = require('mailspring-exports');

const CONFIG_KEY = 'smart-folders.definitions';

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sourceKey(source) {
  return JSON.stringify([source.accountId, source.categoryId]);
}

function normalizeSource(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }
  if (!hasText(source.accountId) || !hasText(source.categoryId)) {
    return null;
  }

  const normalized = {
    accountId: source.accountId,
    categoryId: source.categoryId,
  };
  if (hasText(source.accountName)) {
    normalized.accountName = source.accountName;
  }
  if (hasText(source.categoryName)) {
    normalized.categoryName = source.categoryName;
  }
  return normalized;
}

function normalizeDefinitions(definitions) {
  if (!Array.isArray(definitions)) {
    return [];
  }

  const normalized = [];
  const definitionIds = new Set();

  definitions.forEach((definition) => {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      return;
    }
    if (!hasText(definition.id) || !hasText(definition.name) || definitionIds.has(definition.id)) {
      return;
    }
    if (!Array.isArray(definition.sources)) {
      return;
    }

    const sourceKeys = new Set();
    const sources = [];
    definition.sources.forEach((source) => {
      const normalizedSource = normalizeSource(source);
      if (!normalizedSource) {
        return;
      }

      const key = sourceKey(normalizedSource);
      if (!sourceKeys.has(key)) {
        sourceKeys.add(key);
        sources.push(normalizedSource);
      }
    });

    if (!sources.length) {
      return;
    }

    definitionIds.add(definition.id);
    normalized.push({
      id: definition.id,
      name: definition.name.trim(),
      sources,
    });
  });

  return normalized;
}

function snapshotSource(account, category) {
  return {
    accountId: account.id,
    categoryId: category.id,
    accountName: account.label || account.id,
    categoryName: category.displayName || category.id,
  };
}

function resolveDefinition(definition) {
  const sources = definition && Array.isArray(definition.sources)
    ? definition.sources
    : [];
  const validCategories = [];
  const missingSources = [];
  const seenSources = new Set();

  sources.forEach((source) => {
    const normalizedSource = normalizeSource(source);
    if (!normalizedSource) {
      return;
    }

    const key = sourceKey(normalizedSource);
    if (seenSources.has(key)) {
      return;
    }
    seenSources.add(key);

    const category = CategoryStore.byId(normalizedSource.accountId, normalizedSource.categoryId);
    if (category) {
      validCategories.push(category);
    } else {
      missingSources.push(normalizedSource);
    }
  });

  return {validCategories, missingSources};
}

module.exports = {
  CONFIG_KEY,
  sourceKey,
  normalizeDefinitions,
  snapshotSource,
  resolveDefinition,
};
