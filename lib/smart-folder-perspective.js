const {
  DatabaseStore,
  Matcher,
  MailboxPerspective,
  MutableQuerySubscription,
  Thread,
} = require('mailspring-exports');
const {resolveDefinition, sourceKey} = require('./smart-folder-definitions');

const DEFAULT_HIDDEN_ROLES = new Set(['spam', 'trash']);

function categoryIds(categories) {
  return categories.map((category) => category.id);
}

function categoriesByVisibility(categories) {
  const hidden = [];
  const normal = [];

  categories.forEach((category) => {
    if (DEFAULT_HIDDEN_ROLES.has(category.role)) {
      hidden.push(category);
    } else {
      normal.push(category);
    }
  });

  return {hidden, normal};
}

function resolutionKeyFor(resolution) {
  return JSON.stringify({
    valid: resolution.validCategories.map((category) => [
      category.accountId,
      category.id,
      category.role,
    ]),
    missing: resolution.missingSources.map(sourceKey),
  });
}

function sqlValues(values) {
  return values.map((value) => `'${String(value).replace(/'/g, "''")}'`).join(', ');
}

class MixedVisibilityMatcher extends Matcher {
  constructor(hiddenCategoryIds) {
    // Use an otherwise unrelated thread attribute to deliberately keep this
    // predicate in the outer query. The category join is needed both for exact
    // membership and for its index; moving this predicate into its subquery
    // would make a selected normal label leak a thread that is only visible in
    // an unselected spam or trash folder.
    super(Thread.attributes.subject, 'smart-folder-mixed-visibility', hiddenCategoryIds);
  }

  evaluate(thread) {
    return (
      thread.inAllMail === true ||
      (thread.categories || []).some((category) => this.val.indexOf(category.id) !== -1)
    );
  }

  whereSQL(klass) {
    const categoryTable = Thread.attributes.categories.tableNameForJoinAgainst(klass);
    return `(${klass.name}.\`inAllMail\` = 1 OR EXISTS (SELECT 1 FROM \`${categoryTable}\` AS \`SmartFolderHiddenCategory\` WHERE \`SmartFolderHiddenCategory\`.\`id\` = \`${klass.name}\`.\`id\` AND \`SmartFolderHiddenCategory\`.\`value\` IN (${sqlValues(this.val)})))`;
  }
}

class SmartFolderPerspective extends MailboxPerspective {
  constructor(definition) {
    super([]);

    this.definition = definition;
    this.definitionId = definition.id;
    this.name = definition.name;
    this.iconName = 'folder.png';
    this.resolutionKey = resolutionKeyFor(this._resolution());

    Object.defineProperty(this, 'accountIds', {
      enumerable: true,
      get: () => [...new Set(this.categories().map((category) => category.accountId))],
    });
  }

  _resolution() {
    return resolveDefinition(this.definition);
  }

  categories() {
    return this._resolution().validCategories;
  }

  isEqual(other) {
    return (
      other instanceof SmartFolderPerspective &&
      this.definitionId === other.definitionId &&
      this.name === other.name &&
      this.resolutionKey === other.resolutionKey
    );
  }

  emptyMessage() {
    return this.categories().length === 0
      ? 'None of this Smart Folder’s sources are currently available.'
      : 'No messages in this Smart Folder.';
  }

  needsHiddenMessagesRevealed() {
    const categories = this.categories();
    return (
      categories.some((category) => DEFAULT_HIDDEN_ROLES.has(category.role)) &&
      !categories.every((category) => category.role === 'spam') &&
      !categories.every((category) => category.role === 'trash')
    );
  }

  threads() {
    const categories = this.categories();
    if (categories.length === 0) {
      return MailboxPerspective.forNothing().threads();
    }

    const {hidden, normal} = categoriesByVisibility(categories);
    const query = DatabaseStore.findAll(Thread)
      .where(Thread.attributes.categories.containsAny(categoryIds(categories)))
      .limit(0);

    if (hidden.length === 0) {
      query.where(Thread.attributes.inAllMail.equal(true));
    } else if (normal.length > 0) {
      query.where(new MixedVisibilityMatcher(categoryIds(hidden)));
    }

    const categoryCountsByAccount = new Map();
    categories.forEach((category) => {
      const count = (categoryCountsByAccount.get(category.accountId) || 0) + 1;
      categoryCountsByAccount.set(category.accountId, count);
    });
    if ([...categoryCountsByAccount.values()].some((count) => count > 1)) {
      query.distinct();
    }

    return new MutableQuerySubscription(query, {
      emitResultSet: true,
      updateOnSeparateThread: true,
    });
  }

  canReceiveThreadsFromAccountIds() {
    return false;
  }

  actionsForReceivingThreads() {
    return [];
  }
}

function isSmartFolderPerspective(perspective) {
  return perspective instanceof SmartFolderPerspective;
}

module.exports = {
  SmartFolderPerspective,
  isSmartFolderPerspective,
};
