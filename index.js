const { withUiHook, htm } = require('@zeit/integration-utils')
const moment = require('moment');
const { promisify } = require('util')
const issueView = require('./issueView');
const {
  getIssues,
  updateIssues,
  getMembers,
} = require('./api')

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

  // Reset state on load
  if (action === 'view') {
    page = 1;
    if (
      metadata.linkedApplications[projectId].envAuthToken &&
      metadata.linkedApplications[projectId].organizationSlug &&
      metadata.linkedApplications[projectId].projectSlug
    ) {
      let issues
      let members
      try {
        issues = await getIssues(
          metadata.linkedApplications[projectId].envAuthToken,
          metadata.linkedApplications[projectId].organizationSlug,
          metadata.linkedApplications[projectId].projectSlug,
          clientState.issueStatusFilter || 'resolved',
        );

        members = await getMembers(
          metadata.linkedApplications[projectId].envAuthToken,
          metadata.linkedApplications[projectId].organizationSlug,
          metadata.linkedApplications[projectId].projectSlug,
          clientState.issueStatusFilter || 'resolved',
        );

        // console.log('member:', members)
      } catch (err) {
        throwDisplayableError({ message: `There was an error fetching issues. ${err.message}` })
      }
      metadata.linkedApplications[projectId].issues = issues;
      metadata.linkedApplications[projectId].members = members;
      await zeitClient.setMetadata(metadata)
    }
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
      if (
        !metadata.linkedApplications[projectId].envAuthToken ||
        !metadata.linkedApplications[projectId].organizationSlug ||
        !metadata.linkedApplications[projectId].projectSlug
      ) {
        throwDisplayableError({ message: 'AUTH_TOKEN, ORGANIZATION_SLUG, and PROJECT_SLUG must be set.' })
      }

      let issues
      try {
        issues = await getIssues(
          metadata.linkedApplications[projectId].envAuthToken,
          metadata.linkedApplications[projectId].organizationSlug,
          metadata.linkedApplications[projectId].projectSlug,
          clientState.issueStatusFilter || 'resolved',
        );
      } catch (err) {
        throwDisplayableError({ message: `There was an error fetching issues. ${err.message}` })
      }
      metadata.linkedApplications[projectId].issues = issues;
      await zeitClient.setMetadata(metadata)
    }

    if (action === 'resolve') {
      const issuesToResolve = [];

      console.log(clientState)

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


    if (action === 'assignTo') {
      const issuesToAssign = [];
      metadata.linkedApplications[projectId].issues.forEach((el) => {
        if (clientState[el.id]) {
          issuesToAssign.push(el.id);
        }
      })

      console.log(slug)
      console.log(clientState)

      // try {
      //   await updateIssues(
      //     metadata.linkedApplications[projectId].envAuthToken,
      //     metadata.linkedApplications[projectId].organizationSlug,
      //     metadata.linkedApplications[projectId].projectSlug,
      //     issuesToAssign,
      //     {assignedTo: clientState.assignTo},
      //   )
      // }
      // catch (err) {
      //   throwDisplayableError({ message: `There was an error updating issues. ${err.message}` })
      // }
    }

  } catch (err) {
    if (err.displayable) {
      errorMessage = err.message
    } else {
      throw err
    }
  }

  if (action === 'next-page') {
    if (page * itemsPerPage < metadata.linkedApplications[projectId].issues.length) {
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
    data: metadata.linkedApplications[projectId].issues,
    members: metadata.linkedApplications[projectId].members,
    clientState,
    action,
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

