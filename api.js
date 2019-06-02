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
  console.log("MAKE REQUEST")
  // let allOptions = {
  //   cache: 'no-cache',
  //   ...options
  // };
  if (method === 'GET') {
    url.search = new URLSearchParams(params)
    console.log(url.href)
    return fetchRequest(url.href, options)
  }

 const allOptions = {
    method,
    cache: 'no-cache',
    body: JSON.stringify(params),
    ...options
  };

  return fetchRequest(url.href, allOptions);
}

module.exports.getIssues = (authToken, organizationSlug, projectSlug, status='unresolved', sort='freq') => {
  const options = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
  }

  const params = {
    query: status === 'all' ? '' : `is:${status}`,
    sort,
  }

  return request('GET', `/projects/${organizationSlug}/${projectSlug}/issues/`, params, options)
}

module.exports.getMembers = (authToken, organizationSlug, projectSlug) => {
  const options = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
  }

  return request('GET', `/projects/${organizationSlug}/${projectSlug}/members/`, null, options)
}

module.exports.updateIssues = (authToken, organizationSlug, projectSlug, ids, params) => {
  const options = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
  }

  const idParams = ids.map((id) => `id=${id}`).join('&');
  return request('PUT', `/projects/${organizationSlug}/${projectSlug}/issues/?${idParams}`, params, options)
}