require('isomorphic-fetch');
require('url-search-params-polyfill');
var URL = require('url').URL;

const fetchRequest = async (url, options = null) => {
  const response = await fetch(url, options);
  const json = await response.json();

  if (!response.ok) {
    return Promise.reject(new Error(json.detail));
  }

  return Promise.resolve({
    response,
    json,
  });
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
    limit: '10'
  }

  return request('GET', `/projects/${organizationSlug}/${projectSlug}/issues/`, params, options)
}

module.exports.paginateIssues = (authToken, organizationSlug, projectSlug, paginationURL, status='unresolved', sort='freq',) => {
  const options = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
  }

  // const params = {
  //   query: status === 'all' ? '' : `is:${status}`,
  //   sort,
  //   limit: '10'
  // }

  console.log("paginate to: ", paginationURL)
  return request('GET', paginationURL, {}, options)
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