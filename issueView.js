const {withUiHook, htm} = require('@zeit/integration-utils');
var moment = require('moment');

module.exports = (props) => {
  const { page, itemsPerPage, data } = props;

  return htm`
    <Container>
      <Box display="flex" justifyContent="space-between">
        <H1> Errors (${data.length})</H1>
        <Button action="getIssues">Get Issues</Button>
      </Box>
      ${data.map((item, index) => {
        if (page === Math.ceil((index + 1)/itemsPerPage)) {
          const imgURL = `https://s1.sentry-cdn.com/_static/df7081b5c6bb784faeea5116bd62b398/sentry/dist/${item.project.slug}.svg`
          const lastSeen = moment(item.lastSeen).fromNow();
          return htm`
            <Box display="flex" justifyContent="space-between" flexDirection="column" border="1px solid #eaeaea" borderRadius="5px" padding="16px" margin="8px 0">
              <Box display="flex" justifyContent="space-between">
                <Box>
                  <Link href="${item.permalink}?project=${item.project.id}&query=is%3Aunresolved" target="_blank">
                    <Box display="flex">
                      <Box color="#067df7" fontWeight="bold" marginRight="5px">${item.metadata.type}</Box>
                      <Box color="black" >${item.culprit}</Box>
                    </Box>
                  </Link>
                  <P>${item.metadata.value}</P>
                  <Box display="flex">
                    <Box marginRight="5px" display="flex" alignItems="center">
                      <Img src="${imgURL}" height="14px" width="14px" />
                    </Box>
                    <Box marginRight="5px">${item.shortId}</Box>
                    <Box>${lastSeen}</Box>
                  </Box>
                </Box>
                <Box display="flex">
                  <Box>
                    <Box textAlign="center">Count</Box>
                    <Box textAlign="center">${item.count}</Box>
                  </Box>
                  <Box>
                    <Box textAlign="center">Users</Box>
                    <Box textAlign="center">${item.userCount}</Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          `
        }
        return htm`<Box />`
      })}
      <Box display="flex" justifyContent="space-between">
        <Box>
          Page: ${page} / ${Math.ceil(data.length / itemsPerPage)}
        </Box>
        <Box>
          <Button action="prev-page" disabled="${page === 1}">prev</Button>
          <Button action="next-page" disabled="${page * itemsPerPage >= data.length}">next</Button>
        </Box>
      </Box>
    </Container>
  `
};
