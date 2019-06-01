require('isomorphic-fetch');

module.exports.getIssues = async (url, options = null) => {
  const response = await fetch(url, options);
  const json = await response.json();
  return Promise.resolve(json);
}