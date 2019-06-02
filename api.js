require('isomorphic-fetch');
require('url-search-params-polyfill');
var URL = require('url').URL;

const fetchRequest = async (url, options = null) => {
  const response = await fetch(url, options);
  const json = await response.json();

  if (!response.ok) {
    return Promise.reject(new Error(json.detail));
  }

  return Promise.resolve(json);
}

const request = (method, path = '', params = null, options = null) => {
  const url = new URL(`https://sentry.io/api/0${path}`)

  if (method === 'GET') {
    url.search = new URLSearchParams(params)
    return fetchRequest(url.href, options)
  }

  const allOptions = {
    method,
    body: JSON.stringify(params),
    cache: 'no-cache',
    ...options
  };

  return fetchRequest(url.href, allOptions);
}

module.exports.getIssues = (authToken, organizationSlug, projectSlug, status='unresolved') => {
  const options = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
  }
  console.log(status)
  const params = {
    query: status === 'all' ? '' : `is:${status}`,
  }

  return request('GET', `/projects/${organizationSlug}/${projectSlug}/issues/`, params, options)
}

module.exports.updateIssues = (authToken, organizationSlug, projectSlug, ids, status) => {
  const options = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
  }
  const params = {
    status,
  }
  const idParams = ids.map((id) => `id=${id}`).join('&');
  return request('PUT', `/projects/${organizationSlug}/${projectSlug}/issues/?${idParams}`, params, options)
}