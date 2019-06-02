const { withUiHook, htm } = require('@zeit/integration-utils')
const moment = require('moment');
const { promisify } = require('util')
const issueView = require('./issueView');
const {
  getIssues,
  updateIssues,
  paginateIssues,
  getMembers,
} = require('./api');

const itemsPerPage = 10;
let page = 1;
let isMissingSettings = true;
let showSettings = false;
let selectAll = false;

const throwDisplayableError = ({ message }) => {
  const error = new Error(message)
  error.displayable = true
  throw error
}

const getPaginationLinks = (res) => {
  const linkHeaders = res.response.headers.get('Link');
  let prevLink = '';
  let nextLink = '';
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

const requireSetup = (metadata, projectId) => {
  if (
    !metadata.linkedApplications[projectId].envAuthToken ||
    !metadata.linkedApplications[projectId].organizationSlug ||
    !metadata.linkedApplications[projectId].projectSlug
  ) {
    throwDisplayableError({ message: 'AUTH_TOKEN, ORGANIZATION_SLUG, and PROJECT_SLUG must be set.' })
  }
}

const refreshIssues = async (clientState, metadata, projectId, zeitClient) => {
  if (!metadata.linkedApplications) {
    metadata.linkedApplications = {}
  }

  try {
    res = await getIssues(
      metadata.linkedApplications[projectId].envAuthToken,
      metadata.linkedApplications[projectId].organizationSlug,
      metadata.linkedApplications[projectId].projectSlug,
      clientState.issueStatusFilter || 'resolved',
    );

    issues = res.json;
    // const { prevLink, nextLink} = getPaginationLinks(res);
    // metadata.linkedApplications[projectId].prevLink = prevLink;
    // metadata.linkedApplications[projectId].nextLink = nextLink;
    metadata.linkedApplications[projectId].issues = issues;

    // console.log("get issues prev link ", prevLink);
    // console.log("get issues next link ", nextLink)
  
    await zeitClient.setMetadata(metadata)
    return issues;
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
      prevLink: '',
      nextLink: '',
    }
  }
  let errorMessage = ''

  // Reset state on load
  if (action === 'view') {
    page = 1;
    requireSetup(metadata, projectId)
    await refreshIssues(clientState, metadata, projectId, zeitClient)
    let members;
    try {
      res = await getMembers(
        metadata.linkedApplications[projectId].envAuthToken,
        metadata.linkedApplications[projectId].organizationSlug,
        metadata.linkedApplications[projectId].projectSlug,
        clientState.issueStatusFilter || 'resolved',
      );
      members = res.json;
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
      metadata.linkedApplications[projectId].issues.forEach((el) => {
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

    if (action === 'next-page') {
      const linkToUse = metadata.linkedApplications[projectId].nextLink;
      if (linkToUse) {
        page++;
        if (
          !metadata.linkedApplications[projectId].envAuthToken ||
          !metadata.linkedApplications[projectId].organizationSlug ||
          !metadata.linkedApplications[projectId].projectSlug
        ) {
          throwDisplayableError({ message: 'AUTH_TOKEN, ORGANIZATION_SLUG, and PROJECT_SLUG must be set.' })
        }

        let issues;
        try {
          linkToUse = linkToUse.substr(linkToUse.indexOf('projects') - 1)
          const res = await paginateIssues(
            metadata.linkedApplications[projectId].envAuthToken,
            metadata.linkedApplications[projectId].organizationSlug,
            metadata.linkedApplications[projectId].projectSlug,
            linkToUse.substr(linkToUse.indexOf('projects') - 1),
            clientState.issueStatusFilter || 'resolved',
            clientState.issueSortByFilter || 'freq',
          );
          issues = res.json;
          // const { prevLink, nextLink} = getPaginationLinks(res);
          // metadata.linkedApplications[projectId].prevLink = prevLink;
          // metadata.linkedApplications[projectId].nextLink = nextLink;
        } catch (err) {
          throwDisplayableError({ message: `There was an error fetching issues. ${err.message}` })
        }
        metadata.linkedApplications[projectId].issues = issues;
        await zeitClient.setMetadata(metadata)
      }
    }

    if (action === 'prev-page') {
      const linkToUse = metadata.linkedApplications[projectId].prevLink;
      if (linkToUse) {
        page--;
        if (
          !metadata.linkedApplications[projectId].envAuthToken ||
          !metadata.linkedApplications[projectId].organizationSlug ||
          !metadata.linkedApplications[projectId].projectSlug
        ) {
          throwDisplayableError({ message: 'AUTH_TOKEN, ORGANIZATION_SLUG, and PROJECT_SLUG must be set.' })
        }

        let issues;
        try {
          linkToUse = linkToUse.substr(linkToUse.indexOf('projects') - 1)
          const res = await paginateIssues(
            metadata.linkedApplications[projectId].envAuthToken,
            metadata.linkedApplications[projectId].organizationSlug,
            metadata.linkedApplications[projectId].projectSlug,
            linkToUse.substr(linkToUse.indexOf('projects') - 1),
            clientState.issueStatusFilter || 'resolved',
            clientState.issueSortByFilter || 'freq',
          );
          issues = res.json;
          // const { prevLink, nextLink} = getPaginationLinks(res);
          // metadata.linkedApplications[projectId].prevLink = prevLink;
          // metadata.linkedApplications[projectId].nextLink = nextLink;
        } catch (err) {
          throwDisplayableError({ message: `There was an error fetching issues. ${err.message}` })
        }
        metadata.linkedApplications[projectId].issues = issues;
        await zeitClient.setMetadata(metadata)
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
    data: metadata.linkedApplications[projectId].issues,
    members: metadata.linkedApplications[projectId].members,
    clientState,
    action,
    prevLink: metadata.linkedApplications[projectId].prevLink,
    nextLink: metadata.linkedApplications[projectId].nextLink,
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

