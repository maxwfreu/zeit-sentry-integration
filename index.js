const { withUiHook, htm } = require('@zeit/integration-utils')
const moment = require('moment');
const { promisify } = require('util')
const issueView = require('./issueView');
const settingsView = require('./settingsView');

const {
  getIssues,
  updateIssues,
  getMembers,
  getDSN,
} = require('./api')

const itemsPerPage = 10;
let page = 1;
let isMissingSettings = true;
let showSettings = false;
let selectAll = false;
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
    throwDisplayableError({ message: 'SENTRY_AUTH_TOKEN, ORGANIZATION_SLUG, and PROJECT_SLUG must be set.' })
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
    issueStatusFilter = 'unresolved';
  }

  if (validSortByFilters.indexOf(issueSortByFilter) < 0) {
    issueSortByFilter = 'freq';
  }

  console.log('issueStatusFilter: ', issueStatusFilter);
  console.log('issueSortByFilter: ', issueSortByFilter);

  try {
    issues = await getIssues(
      metadata.linkedApplications[projectId].envAuthToken,
      metadata.linkedApplications[projectId].organizationSlug,
      metadata.linkedApplications[projectId].projectSlug,
      issueStatusFilter,
      issueSortByFilter,
    );
  } catch (err) {
    console.log(err)
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
  if (action === 'view' && !isMissingSettings) {
    page = 1;
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
    if (action === 'submit') {
      // set metadata
      metadata.linkedApplications[projectId].envAuthToken = clientState.envAuthToken
      await zeitClient.setMetadata(metadata)
      // set env vars
      const secretNameApiKey = await zeitClient.ensureSecret(
        'auth-token',
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
      const dsn = `https://${dsnRes[0].id}@sentry.io/${dsnRes[0].projectId}`;

      await zeitClient.upsertEnv(
        payload.projectId,
        'SENTRY_DSN',
        dsn
      )

      await refreshIssues(clientState, metadata, projectId, zeitClient)
    }

    if (action == 'showSettings') {
      showSettings = true;
    }

    if (action === 'getIssues') {
      requireSetup(metadata, projectId)
      await refreshIssues(clientState, metadata, projectId, zeitClient)
    }

    if (action === 'resolve') {
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
      }
      catch (err) {
        throwDisplayableError({ message: `There was an error updating issues. ${err.message}` })
      }
    }

    if (action.indexOf('AssignTo') !== -1) {
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

  if (action === 'next-page') {
    if (page * itemsPerPage < issues.length) {
      page++;
    }
  }

  if (action === 'prev-page') {
    if ( page > 1) {
      page --;
    }
  }

  if (action === 'clear-filter') {
    clientState.issueFilter = '';
  }

  let View;
  if (isMissingSettings || showSettings) {
    View = settingsView({
      metadata,
      errorMessage,
      projectId,
    });
  } else {
    View = issueView({
      page,
      itemsPerPage,
      data: issues,
      members: metadata.linkedApplications[projectId].members,
      clientState,
      action,
    });
  }

  return htm`
    <Page>
      ${errorMessage && htm`<Notice type="error">${errorMessage}</Notice>`}
      ${View}
    </Page>
  `
});

