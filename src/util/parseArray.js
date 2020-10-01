module.exports = (data, forceArray = true) => {
  if (Array.isArray(data)) return data;
  let temp;
  try {
    temp = JSON.parse(data);
  } catch {}
  if (Array.isArray(temp)) return temp;
  if (forceArray) return [];
  return undefined;
};
