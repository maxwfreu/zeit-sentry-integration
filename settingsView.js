const { htm } = require('@zeit/integration-utils');

module.exports = (props) => {
  const {
    errorMessage,
    metadata,
    projectId,
  } = props;

  const code = `
    import * as Sentry from '@sentry/browser';
    Sentry.init({ dsn: process.env.SENTRY_DSN });
    Sentry.captureException("My first error");
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
                <P>You can find your auth token at <Link href="https://sentry.io/settings/account/api/auth-tokens/" target="_blank">Sentry Auth Token</Link>. The configured keys will be availble as environment variables in your deployment as <B>SENTRY_AUTH_TOKEN</B> the next time you deploy. Additionally, <B>SENTRY_DSN</B> will be available for initializing in your application.</P>
                <Input
                  label="SENTRY_AUTH_TOKEN"
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
                <H1> Enable Sentry </H1>
                <P>To start collecting errors in sentry, insert the sentry script in your application.</P>
                <H2> React Example: </H2>
                <Code>${code}</Code>
              </Container>
            </FsContent>
            <FsFooter>
              <Container>
                <Button action="submit">Submit Keys</Button>
              </Container>
            </FsFooter>
          </Fieldset>
        </Box>
    </Container>
  `
};
