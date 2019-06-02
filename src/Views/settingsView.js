const { htm } = require('@zeit/integration-utils');
const { Actions } = require('../Actions');

module.exports = (props) => {
  const {
    errorMessage,
    metadata,
    projectId,
  } = props;

  const initialSnippet = `
    import * as Sentry from '@sentry/browser';

    Sentry.init({ dsn: process.env.SENTRY_DSN });
  `

  const usageSnippet = `
    process.on('uncaughtException', (err) => {
      Sentry.captureException(err);
    });
  `

  const availableEnvVariables = `
    process.env.SENTRY_DSN
    process.env.SENTRY_AUTH_TOKEN
    process.env.SENTRY_ORGANIZATION_SLUG
    process.env.SENTRY_PROJECT_SLUG
    process.env.SENTRY_PROJECT_ID
  `

  return htm`
    <Container>
        <Box>
          <Box marginBottom="10px" textAlign="right">
            <ProjectSwitcher />
          </Box>
          <Box display="flex" justifyContent="center" margin-bottom="2rem">
            <Img src="https://sentry-brand.storage.googleapis.com/sentry-logo-black.png" />
          </Box>
          <Fieldset>
            <FsContent>
              <Container>
                ${errorMessage && htm`<Notice type="error">${errorMessage}</Notice>`}
                <H1>Settings</H1>
                <P>
                  You can find your auth token at <Link href="https://sentry.io/settings/account/api/auth-tokens/" target="_blank">Sentry Auth Token</Link>.
                  Please see the code snippets below for usage details.
                </P>
                <Input
                  label="SENTRY_AUTH_TOKEN"
                  name="envAuthToken"
                  value=${metadata.linkedApplications[projectId].envAuthToken}
                  type="password"
                  width="100%"
                />
               <Input
                  label="SENTRY_ORGANIZATION_SLUG"
                  name="organizationSlug"
                  value=${metadata.linkedApplications[projectId].organizationSlug || ''}
                  width="100%"
                />
               <Input
                  label="SENTRY_PROJECT_SLUG"
                  name="projectSlug"
                  value=${metadata.linkedApplications[projectId].projectSlug || ''}
                  width="100%"
                />
              </Container>
            </FsContent>
            <FsFooter>
              <Container>
                <Button action="${Actions.SUBMIT}">Submit Keys</Button>
              </Container>
            </FsFooter>
          </Fieldset>
          <Fieldset>
            <FsContent>
              <Container>
                  <H1> Enable Sentry </H1>
                  <P>To start collecting errors in sentry, insert the sentry script in your application.</P>
                  <H2> Initialize Sentry: </H2>
                  <Code>${initialSnippet}</Code>
                  <Box marginTop="8px" />
                  <H2> Collect Errors: </H2>
                  <Code>${usageSnippet}</Code>
                  <Box marginTop="8px" />
                  <H2> Available environmental variables </H2>
                  <Code>${availableEnvVariables}</Code>
              </Container>
            </FsContent>
            <FsFooter>
              <Container>
                <Link href="https://github.com/maxwfreu/integrations-hackathon-example" targe="_blank">
                  View Example
                </Link>
                <Link href="https://github.com/maxwfreu/zeit-sentry-integration" targe="_blank">
                  View Source
                </Link>
              </Container>
            </FsFooter>
          </Fieldset>
        </Box>
    </Container>
  `
};
