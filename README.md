# zeit-sentry-integration
Integration Marketplace URL: https://zeit.co/integrations/sentry-monitoring

## Getting Started
To use the integration you will need:
1. A project deployed with [Now](https://zeit.co/docs])
2. A [Sentry](https://sentry.io) account


### Congfiguring the integration
You will need a Sentry API Key, your organization slug, and your project slug. To get your API key login into Sentry, click the dropdown in the top left, then click API Keys.

Your organization slug and project slug are both listed under `Projects`.

The integration exposes everything you need to connect to sentry through environmental variables. You will likely only need `SENTRY_DSN` to connect, but there may be scenarios where you need more than just that. The following environmental variables are provided:
```
  process.env.SENTRY_DSN
  process.env.SENTRY_AUTH_TOKEN
  process.env.SENTRY_ORGANIZATION_SLUG
  process.env.SENTRY_PROJECT_SLUG
  process.env.SENTRY_PROJECT_ID
```

### Examples
See https://github.com/maxwfreu/integrations-hackathon-example for a working example using Next.js
