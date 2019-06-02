const { withUiHook, htm } = require('@zeit/integration-utils')
const moment = require('moment');
const { promisify } = require('util')
const issueView = require('./issueView');
const {
  getIssues,
  updateIssues,
  getMembers,
  getIssuesFromPaginationLink,
} = require('./api')

const itemsPerPage = 10;
let page = 1;
let isMissingSettings = true;
let showSettings = false;
let selectAll = false;
let paginationLinks = {}
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
    throwDisplayableError({ message: 'AUTH_TOKEN, ORGANIZATION_SLUG, and PROJECT_SLUG must be set.' })
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
    const resp = await getIssues(
      metadata.linkedApplications[projectId].envAuthToken,
      metadata.linkedApplications[projectId].organizationSlug,
      metadata.linkedApplications[projectId].projectSlug,
      issueStatusFilter,
      issueSortByFilter,
    );

    paginationLinks = resp.paginationLinks;
    metadata.linkedApplications[projectId].issues = resp.issues;
    await zeitClient.setMetadata(metadata)
    return resp.issues;

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
  let errorMessage = ''

  // Reset state on load
  if (action === 'view') {
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
        'AUTH_TOKEN',
        secretNameApiKey
      )

      metadata.linkedApplications[projectId].organizationSlug = clientState.organizationSlug
      await zeitClient.setMetadata(metadata)
      metadata.linkedApplications[projectId].projectSlug = clientState.projectSlug
      await zeitClient.setMetadata(metadata)

      showSettings = false;
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
    console.log('next-page:', paginationLinks)
    const resp = await getIssuesFromPaginationLink(
      metadata.linkedApplications[projectId].envAuthToken,
      paginationLinks.nextLink,
    );

    console.log(resp);
    // paginationLinks = resp.paginationLinks;
    
    // metadata.linkedApplications[projectId].issues = resp.issues;
    // await zeitClient.setMetadata(metadata)
    // return resp.issues;

    if (page * itemsPerPage < issues.length) {
      page++;
    }
  }

  if (action === 'prev-page') {
    if ( page > 1) {
      page --;
    }
  }

  let isMissingSettings = (
    !metadata.linkedApplications[projectId].envAuthToken ||
    !metadata.linkedApplications[projectId].organizationSlug ||
    !metadata.linkedApplications[projectId].projectSlug
  );

  if (action === 'clear-filter') {
    clientState.issueFilter = '';
  }

  const IssueView = issueView({
    page,
    itemsPerPage,
    data: issues,
    members: metadata.linkedApplications[projectId].members,
    clientState,
    action,
    paginationLinks,
  });

  return htm`
    <Page>
        ${(isMissingSettings || showSettings) ?
          htm`
            <Box>
              <Box marginBottom="10px" textAlign="right">
                <ProjectSwitcher />
              </Box>
              <Box display="flex" justifyContent="center" margin-bottom="2rem">
                <Img src="https://sentry-brand.storage.googleapis.com/sentry-logo-black.png" />
              </Box>
              <Container>
               ${errorMessage && htm`<Notice type="error">${errorMessage}</Notice>`}
                <H1>Settings</H1>
                <P>You can find your auth token at <Link href="https://sentry.io/settings/account/api/auth-tokens/" target="_blank">Sentry Auth Token</Link>. The configured keys will be availble as environment variables in your deployment as <B>AUTH_TOKEN</B> the next time you deploy.</P>
                <Input
                  label="AUTH_TOKEN"
                  name="envAuthToken"
                  value=${metadata.linkedApplications[projectId].envAuthToken}
                  type="password"
                  width="100%"
                />
               <Input
                  label="ORGANIZATION_SLUG"
                  name="organizationSlug"
                  value=${metadata.linkedApplications[projectId].organizationSlug || ''}
                  width="100%"
                />
               <Input
                  label="PROJECT_SLUG"
                  name="projectSlug"
                  value=${metadata.linkedApplications[projectId].projectSlug || ''}
                  width="100%"
                />
              </Container>
              <Container>
                <Button action="submit">Submit Keys</Button>
              </Container>
            </Box>
          `:
          htm`
            <Box>
              ${errorMessage && htm`<Notice type="error">${errorMessage}</Notice>`}
              <Container>
                <Button action="showSettings">Update Settings</Button>
              </Container>
              ${IssueView}
            </Box>
          `
        }
    </Page>
  `
});

