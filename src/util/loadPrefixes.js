module.exports = (overrides = '', defaults = []) => {
  const set = new Set();

  let temp = defaults;
  if (overrides) {
    try {
      temp = JSON.parse(overrides);
    } catch {
      if (overrides.includes(',')) {
        temp = overrides.split(',').map(i => i.trim());
      } else {
        temp = overrides;
      }
    }
  }
  
  if (Array.isArray(temp)) {
    temp.forEach((e) => set.add(e));
  } else if (typeof temp === 'string') {
    set.add(temp);
  }

  return [...set.values()];
};