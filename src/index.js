const { withUiHook, htm } = require('@zeit/integration-utils')
const moment = require('moment');
const { promisify } = require('util');
const {
  issueView,
  settingsView,
} = require('./Views');

const {
  getIssues,
  updateIssues,
  getMembers,
  getIssuesFromPaginationLink,
  getDSN,
} = require('./api');

const { Actions } = require('./Actions');

const itemsPerPage = 10;
let isMissingSettings = true;
let showSettings = false;
let issues = [];


const throwDisplayableError = ({ message }) => {
  const error = new Error(message)
  error.displayable = true
  throw error
}

const requireSetup = (metadata, projectId) => {
  if (
    !metadata.linkedApplications[projectId].envAuthToken ||
    !metadata.linkedApplications[projectId].organizationSlug ||
    !metadata.linkedApplications[projectId].projectSlug
  ) {
    throwDisplayableError({ message: 'SENTRY_AUTH_TOKEN, SENTRY_ORGANIZATION_SLUG, and SENTRY_PROJECT_SLUG must be set.' })
  }
}

const validStatusFilters = [
  'unresolved',
  'resolved',
  'all',
];

const validSortByFilters = [
  'priority',
  'new',
  'date',
  'freq',
];

const refreshIssues = async (clientState, metadata, projectId, zeitClient) => {
  if (!metadata.linkedApplications) {
    metadata.linkedApplications = {}
  }

  let { issueStatusFilter, issueSortByFilter } = clientState;

  if (validStatusFilters.indexOf(issueStatusFilter) < 0) {
    issueStatusFilter = metadata.linkedApplications[projectId].issueStatusFilter;
  }

  if (!issueStatusFilter) {
    issueStatusFilter = 'unresolved';
  }

  if (validSortByFilters.indexOf(issueSortByFilter) < 0) {
    issueSortByFilter = metadata.linkedApplications[projectId].issueSortByFilter;
  }

  if (!issueSortByFilter) {
    issueSortByFilter = 'freq';   
  }

  try {
    const resp = await getIssues(
      metadata.linkedApplications[projectId].envAuthToken,
      metadata.linkedApplications[projectId].organizationSlug,
      metadata.linkedApplications[projectId].projectSlug,
      issueStatusFilter,
      issueSortByFilter,
    );
    issues = resp.issues;

    // Cache issues for actions that don't refresh
    metadata.linkedApplications[projectId].issues = issues;
    metadata.linkedApplications[projectId].paginationLinks = resp.paginationLinks;
    metadata.linkedApplications[projectId].page = 1;
    if (clientState.issueSortByFilter) {
      metadata.linkedApplications[projectId].issueSortByFilter = issueSortByFilter;
    }
    if (clientState.issueStatusFilter) {
      metadata.linkedApplications[projectId].issueStatusFilter = issueStatusFilter;
    }

    await zeitClient.setMetadata(metadata)
  } catch (err) {
    console.log(err)
    throwDisplayableError({ message: `There was an error fetching issues. ${err.message}` })
  }
}

const refreshIssuesForPagination = async (metadata, projectId, zeitClient, link, page) => {
  try {
    const resp = await getIssuesFromPaginationLink(
      metadata.linkedApplications[projectId].envAuthToken,
      link,
    );
    issues = resp.issues;

    metadata.linkedApplications[projectId].issues = issues;
    metadata.linkedApplications[projectId].paginationLinks = resp.paginationLinks;
    metadata.linkedApplications[projectId].page = page;
    await zeitClient.setMetadata(metadata)
  } catch (err) {
    throwDisplayableError({ message: `There was an error fetching issues. ${err.message}` })
  }
}

module.exports = withUiHook(async ({ payload, zeitClient }) => {
  const { clientState, action, projectId, slug } = payload
  if (!projectId) {
    return htm`
      <Page>
        <Notice type="warn">Please select a project to install the Sentry integration.</Notice>
        <ProjectSwitcher />
      </Page>
    `
  }

  const metadata = await zeitClient.getMetadata()
  if (!metadata.linkedApplications) {
    metadata.linkedApplications = {}
  }
  if (!metadata.linkedApplications[projectId]) {
    metadata.linkedApplications[projectId] = {
      envAuthToken: '',
      organizationSlug: '',
      projectSlug: '',
      issues: [],
    }
  }

  let isMissingSettings = (
    !metadata.linkedApplications[projectId].envAuthToken ||
    !metadata.linkedApplications[projectId].organizationSlug ||
    !metadata.linkedApplications[projectId].projectSlug
  );

  let errorMessage = ''

  // Reset state on load
  if (action === Actions.VIEW && !isMissingSettings) {
    requireSetup(metadata, projectId)
    await refreshIssues(clientState, metadata, projectId, zeitClient)
    let members
    try {
      members = await getMembers(
        metadata.linkedApplications[projectId].envAuthToken,
        metadata.linkedApplications[projectId].organizationSlug,
        metadata.linkedApplications[projectId].projectSlug,
      );
    } catch (err) {
      throwDisplayableError({ message: `There was an error fetching issues. ${err.message}` })
    }
    metadata.linkedApplications[projectId].members = members;
    await zeitClient.setMetadata(metadata)
  }

  try {
    if (action === Actions.SUBMIT) {
      // set metadata
      metadata.linkedApplications[projectId].envAuthToken = clientState.envAuthToken
      await zeitClient.setMetadata(metadata)
      // set env vars
      const secretNameApiKey = await zeitClient.ensureSecret(
        'sentry-auth-token',
        metadata.linkedApplications[projectId].envAuthToken
      )
      await zeitClient.upsertEnv(
        payload.projectId,
        'SENTRY_AUTH_TOKEN',
        secretNameApiKey
      )

      metadata.linkedApplications[projectId].organizationSlug = clientState.organizationSlug
      await zeitClient.setMetadata(metadata)
      metadata.linkedApplications[projectId].projectSlug = clientState.projectSlug
      await zeitClient.setMetadata(metadata)

      showSettings = false;

      const dsnRes = await getDSN(
        clientState.envAuthToken,
        clientState.organizationSlug,
        clientState.projectSlug,
      );
      const dsnClientKeyData = dsnRes.json[0];
      console.log(dsnClientKeyData)
      const dsn = `https://${dsnClientKeyData.id}@sentry.io/${dsnClientKeyData.projectId}`;

      // Set DSN
      const secreteDSN = await zeitClient.ensureSecret(
        'sentry-dsn',
        dsn
      )
      await zeitClient.upsertEnv(
        payload.projectId,
        'SENTRY_DSN',
        secreteDSN
      )

      // SET project ID
      const secreteSentryProjectID = await zeitClient.ensureSecret(
        'sentry-project-id',
        dsnClientKeyData.projectId.toString(),
      )
      await zeitClient.upsertEnv(
        payload.projectId,
        'SENTRY_PROJECT_ID',
        secreteSentryProjectID
      )

      // SET project slug
      const secreteSentryProjectSlug = await zeitClient.ensureSecret(
        'sentry-project-slug',
        clientState.projectSlug.toString(),
      )
      await zeitClient.upsertEnv(
        payload.projectId,
        'SENTRY_PROJECT_SLUG',
        secreteSentryProjectSlug
      )

      // SET organization slug
      const secreteSentryOrgSlug = await zeitClient.ensureSecret(
        'sentry-project-slug',
        clientState.organizationSlug.toString(),
      )
      await zeitClient.upsertEnv(
        payload.projectId,
        'SENTRY_ORGANIZATION_SLUG',
        secreteSentryOrgSlug
      )

      await refreshIssues(clientState, metadata, projectId, zeitClient)
    }

    if (action == Actions.SHOW_SETTINGS) {
      showSettings = true;
    }

    if (action === Actions.GET_ISSUES) {
      requireSetup(metadata, projectId)
      await refreshIssues(clientState, metadata, projectId, zeitClient)
    }

    if (action === Actions.RESOLVE) {
      const issuesToResolve = [];
      issues.forEach((el) => {
        if (clientState[el.id]) {
          issuesToResolve.push(el.id);
        }
      })
      try {
        await updateIssues(
          metadata.linkedApplications[projectId].envAuthToken,
          metadata.linkedApplications[projectId].organizationSlug,
          metadata.linkedApplications[projectId].projectSlug,
          issuesToResolve,
          {status: 'resolved'},
        )
        await refreshIssues(clientState, metadata, projectId, zeitClient)
      }
      catch (err) {
        throwDisplayableError({ message: `There was an error updating issues. ${err.message}` })
      }
    }

    if (action === Actions.UNRESOLVE) {
      const issuesToResolve = [];
      issues.forEach((el) => {
        if (clientState[el.id]) {
          issuesToResolve.push(el.id);
        }
      })
      try {
        await updateIssues(
          metadata.linkedApplications[projectId].envAuthToken,
          metadata.linkedApplications[projectId].organizationSlug,
          metadata.linkedApplications[projectId].projectSlug,
          issuesToResolve,
          {status: 'unresolved'},
        )
        await refreshIssues(clientState, metadata, projectId, zeitClient)
      }
      catch (err) {
        throwDisplayableError({ message: `There was an error updating issues. ${err.message}` })
      }
    }

    if (action.indexOf(Actions.ASSIGN_TO) !== -1) {
      const assignTo = clientState[action];
      const [issueId, actionName] = action.split(':')

      try {
        await updateIssues(
          metadata.linkedApplications[projectId].envAuthToken,
          metadata.linkedApplications[projectId].organizationSlug,
          metadata.linkedApplications[projectId].projectSlug,
          [issueId],
          {assignedTo: assignTo},
        )
        await refreshIssues(clientState, metadata, projectId, zeitClient)
      }
      catch (err) {
        throwDisplayableError({ message: `There was an error updating issue. ${err.message}` })
      }
    }
  } catch (err) {
    if (err.displayable) {
      errorMessage = err.message
    } else {
      throw err
    }
  }

  if (action === Actions.NEXT_PAGE) {
    const { paginationLinks, page } = metadata.linkedApplications[projectId];
    let link;
    if (paginationLinks) {
      link = paginationLinks.nextLink;
    }
    let curPage = page;
    if (!curPage) {
      curPage = 1;
    } else {
      curPage++;
    }
    console.log('go go page: ', curPage)
    try {
      await refreshIssuesForPagination(
        metadata,
        projectId,
        zeitClient,
        link,
        curPage,
      )
    } catch(err) {
      throwDisplayableError({ message: `There was an error fetching the next page. ${err.message}` })
    }
  }

  if (action === Actions.PREV_PAGE) {
    const { paginationLinks, page } = metadata.linkedApplications[projectId];
    let link;
    if (paginationLinks) {
      link = paginationLinks.prevLink;
    }
    let curPage = page;
    if (!curPage) {
      curPage = 1;
    } else {
      Math.max(curPage--, 1);
    }
    try {
      await refreshIssuesForPagination(
        metadata,
        projectId,
        zeitClient,
        link,
        curPage,
      )
    } catch(err) {
      throwDisplayableError({ message: `There was an error fetching the previous page. ${err.message}` })
    }
  }

  if (action === Actions.CLEAR_FILTER) {
    clientState.issueFilter = '';
  }

  if (action === Actions.SELECT_ALL || action === Actions.DESELECT_ALL) {
    issues = metadata.linkedApplications[projectId].issues;
  }

  let View;
  if (isMissingSettings || showSettings) {
    View = settingsView({
      metadata,
      errorMessage,
      projectId,
    });
  } else {

    let issueSortByFilter = metadata.linkedApplications[projectId].issueSortByFilter;
    if (clientState.issueSortByFilter) {
      issueSortByFilter = clientState.issueSortByFilter;
    }

    let issueStatusFilter = metadata.linkedApplications[projectId].issueStatusFilter;
    if (clientState.issueStatusFilter) {
      issueStatusFilter = clientState.issueStatusFilter;
    }

    console.log(issueSortByFilter)
    View = issueView({
      page: metadata.linkedApplications[projectId].page || 1,
      itemsPerPage,
      data: issues,
      members: metadata.linkedApplications[projectId].members,
      clientState,
      action,
      paginationLinks: metadata.linkedApplications[projectId].paginationLinks,
      issueSortByFilter: issueSortByFilter || 'freq',
      issueStatusFilter: issueStatusFilter || 'unresolved',
    });
  }

  return htm`
    <Page>
      ${errorMessage && htm`<Notice type="error">${errorMessage}</Notice>`}
      ${View}
    </Page>
  `
});

