const { withUiHook, htm } = require('@zeit/integration-utils')
var moment = require('moment');
const mockData = require('./mockData');
const issueView = require('./issueView');
const data = mockData();
require('isomorphic-fetch');
const { promisify } = require('util')

const sleep = promisify(setTimeout)

const store = {
  secretId: '',
  secretKey: ''
};

const itemsPerPage = 10;
let page = 1;

const getIssues = async (url, options = null) => {
  const response = await fetch(url, options);
  const json = await response.json();
  return Promise.resolve(json);
}


const throwDisplayableError = ({ message }) => {
  const error = new Error(message)
  error.displayable = true
  throw error
}

module.exports = withUiHook(async ({ payload, zeitClient }) => {
  const { clientState, action, projectId } = payload
  if (!projectId) {
    return htm`
      <Page>
        <Notice type="warn">Please select a project to install the Sentry integration.</Notice>
        <ProjectSwitcher />
      </Page>
    `
  }

  // Reset state on load
  if (action === 'view') {
    page = 1;
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
    }

    if (action === 'getIssues') {
      if(
        !metadata.linkedApplications[projectId].envAuthToken ||
        !metadata.linkedApplications[projectId].organizationSlug ||
        !metadata.linkedApplications[projectId].projectSlug

      ){
        throwDisplayableError({ message: 'AUTH_TOKEN must be set' })
      }

      let issues_returned
      try {

        const options = {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${metadata.linkedApplications[projectId].envAuthToken}`
          },
        }

        issues_returned = await getIssues(`https://sentry.io/api/0/projects/${metadata.linkedApplications[projectId].organizationSlug}/react/issues/`, options)
      } catch (err) {
        console.error(err)
        throwDisplayableError({ message: 'There was an error fetching issues.' })
      }
      metadata.linkedApplications[projectId].issues = issues_returned;
      await zeitClient.setMetadata(metadata)
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

  if (action === 'resolve') {
    const issuesToResolve = [];
    metadata.linkedApplications[projectId].issues.forEach((el) => {
      if (clientState[el.id]) {
        issuesToResolve.push(el.id);
      }
    })
    console.log("Resolving: ", issuesToResolve);
  }

  if (action === 'clear-filter') {
    clientState.issueFilter = '';
  }

  const IssueView = issueView({
    page,
    itemsPerPage,
    data: metadata.linkedApplications[projectId].issues,
    clientState,
    action,
  });

  return htm`
        <Page>
            <Box marginBottom="10px" textAlign="right">
              <ProjectSwitcher />
            </Box>
            <Box display="flex" justifyContent="center" margin-bottom="2rem">
              <Img src="https://sentry-brand.storage.googleapis.com/sentry-logo-black.png" />
            </Box>
            <Container>
             ${errorMessage && htm`<Notice type="error">${errorMessage}</Notice>`}
              <H1>Environment Variables</H1>
              <P>These are the <Link href="https://docs.datadoghq.com/account_management/api-app-keys/" target="_blank">Sentry API and APP keys</Link>. The configured keys will be availble as environment variables in your deployment as <B>AUTH_TOKEN</B> the next time you deploy.</P>
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

            ${IssueView}
        </Page>
    `
});

