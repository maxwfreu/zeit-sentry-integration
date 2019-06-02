require('isomorphic-fetch');
require('url-search-params-polyfill');
var URL = require('url').URL;

const fetchRequest = async (url, options = null) => {
  const response = await fetch(url, options);

  console.log(response)

  const json = await response.json();

  if (!response.ok) {
    return Promise.reject(new Error(json.detail));
  }

  return Promise.resolve({
    response,
    json
  });
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

const getHeaders = (authToken) => {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
  }
}

const getPaginationLinks = (res) => {
  const linkHeaders = res.headers.get('Link');
  if (!linkHeaders) {
    return {
      prevLink: '',
      nextLink: '',
    }
  }
  linkHeadersArr = linkHeaders.split(',');
  const prevArr = linkHeadersArr[0].split(';');
  const nextarr = linkHeadersArr[1].split(';');

  const prev = prevArr[0].trim()
  console.log(prevArr)
  const needsPrevLink = prevArr[2].indexOf('results="true"') > -1;
  if (needsPrevLink) {
    prevLink = prev.substr(1, prev.length - 2);
  } else {
    prevLink = '';
  }

  const next = nextarr[0].trim()
  const needsNextLink = nextarr[2].indexOf('results="true"') > -1;
  if (needsNextLink) {
    nextLink = next.substr(1, next.length - 2);
  } else {
    nextLink = '';
  }
  return { prevLink, nextLink };
};

module.exports.getIssues = async (authToken, organizationSlug, projectSlug, status='unresolved', sort='freq') => {
  const options = getHeaders(authToken);
  const params = {
    query: status === 'all' ? '' : `is:${status}`,
    sort,
    limit: '10'
  }

  const r = await request('GET', `/projects/${organizationSlug}/${projectSlug}/issues/`, params, options)

  const paginationLinks = getPaginationLinks(r.response)
  console.log('paginationLinks:', paginationLinks)

  return {
    issues: r.json,
    paginationLinks: paginationLinks,
  }
}

module.exports.getIssuesFromPaginationLink = async (authToken, link) => {
  const options = getHeaders(authToken);
  const r = await request('GET', link.replace('https://sentry.io/api/0', ''), null, options)
  const paginationLinks = getPaginationLinks(r.response)
  return {
    issues: r.json,
    paginationLinks: paginationLinks,
  }
}

module.exports.getMembers = async (authToken, organizationSlug, projectSlug) => {
  const options = getHeaders(authToken);
  const r = await request('GET', `/projects/${organizationSlug}/${projectSlug}/members/`, null, options)
  return r.json
}

module.exports.updateIssues = async (authToken, organizationSlug, projectSlug, ids, params) => {
  const options = getHeaders(authToken);
  const idParams = ids.map((id) => `id=${id}`).join('&');
  const r = await request('PUT', `/projects/${organizationSlug}/${projectSlug}/issues/?${idParams}`, params, options)
  return r.json
}