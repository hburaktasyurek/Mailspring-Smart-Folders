function categoryLabel(category) {
  return category.displayName || category.id;
}

function categoryPath(category, splitRegex) {
  return categoryLabel(category).replace(splitRegex, '/');
}

function buildCategoryTree(categories, splitRegex) {
  const roots = [];
  const nodesByPath = Object.create(null);
  const sortedCategories = (categories || [])
    .slice()
    .sort((left, right) => {
      const pathOrder = categoryPath(left, splitRegex).localeCompare(
        categoryPath(right, splitRegex)
      );

      return pathOrder || String(left.id).localeCompare(String(right.id));
    });

  sortedCategories.forEach((category) => {
    const path = categoryPath(category, splitRegex);
    const parts = path.split('/');
    let parent = null;
    let parentLength = 0;

    for (let length = parts.length - 1; length > 0; length -= 1) {
      const parentNode = nodesByPath[parts.slice(0, length).join('/')];

      if (parentNode) {
        parent = parentNode;
        parentLength = length;
        break;
      }
    }

    const node = {
      category,
      children: [],
      label: parent ? parts.slice(parentLength).join('/') : categoryLabel(category),
    };

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }

    nodesByPath[path] = node;
  });

  return roots;
}

module.exports = {buildCategoryTree};
