const {withUiHook, htm} = require('@zeit/integration-utils');
var moment = require('moment');

module.exports = (props) => {
  const {
    page,
    itemsPerPage,
    data,
    clientState,
    action,
    members,
  } = props;

  return htm`
    <Container>
      <Fieldset>
        <FsContent>
          <Box display="flex" justifyContent="space-between" padding="16px 0" alignItems="center">
            <Box display="flex" flexDirection="row" alignItems="center">
              <Box marginRight="8px">Status Filter:</Box>
              <Select name="issueStatusFilter" value="${clientState.issueStatusFilter || 'unresolved'}" action="getIssues">
                <Option value="unresolved" caption="Unresolved" />
                <Option value="resolved" caption="Resolved" />
                <Option value="all" caption="All" />
              </Select>
            </Box>
            <Box display="flex" flexDirection="row" alignItems="center">
              <Box marginRight="8px">Issue Filter:</Box>
              <Box marginRight="16px" display="flex" alignItems="center">
                <Input name="issueFilter" value="${clientState.issueFilter || ''}" />
              </Box>
              <Box marginRight="${clientState.issueFilter ? '16px' : ''}" display="flex" alignItems="center">
                <Button action="filter-issues" secondary small>Filter</Button>
              </Box>
              ${clientState.issueFilter ? htm`
                <Box display="flex" alignItems="center">
                  <Button action="clear-filter" secondary small>Clear</Button>
                </Box>
              ` : ""}
            </Box>
          </Box>
        </FsContent>
      </Fieldset>
      <Fieldset>
        <FsContent>
          <Box display="flex" justifyContent="space-between" padding="16px 0" alignItems="center">
            <Box display="flex" flexDirection="row">
              <Box marginRight="16px" display="flex" alignItems="center">
                <H1> Errors (${data.length})</H1>
              </Box>
            </Box>
            <Button action="getIssues" small>Refresh</Button>
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" flexDirection="row" alignItems="center">
              <Box marginRight="8px">
                <Button action="resolve" small secondary>Resolve Selected</Button>
              </Box>
              <Box marginRight="8px">
                <Button action="unresolve" small secondary>Unresolve Selected</Button>
              </Box>
              <Box marginRight="8px">
                <Button
                  action="${action === 'select-all' ? 'deselect-all': 'select-all'}"
                  secondary
                  small
                >
                   ${action === 'select-all' ? 'Deselect All': 'Select All'}
                </Button>
              </Box>
            </Box>
            <Box display="flex" flexDirection="row" marginRight="16px">
              <Box width="64px" display="flex" justifyContent="center" alignItems="center">Count</Box>
              <Box width="64px" display="flex" justifyContent="center" alignItems="center">Users</Box>
            </Box>
          </Box>
          ${data.map((item, index) => {
            let assignedTo = null;
            if (item.assignedTo) {
              assignedTo = item.assignedTo.id
            }

            let inFilter = true;
            const { issueFilter } = clientState;
            if (issueFilter) {
              inFilter = false;
              if (item.culprit.toLowerCase().indexOf(issueFilter.toLowerCase()) > -1) {
                inFilter = true;
              }
              if (item.metadata.type.toLowerCase().indexOf(issueFilter.toLowerCase()) > -1) {
                inFilter = true;
              }
              if (item.metadata.value.toLowerCase().indexOf(issueFilter.toLowerCase()) > -1) {
                inFilter = true;
              }
            }
            if (page === Math.ceil((index + 1)/itemsPerPage) && inFilter) {
              const imgURL = `https://s1.sentry-cdn.com/_static/df7081b5c6bb784faeea5116bd62b398/sentry/dist/${item.project.slug}.svg`
              const lastSeen = moment(item.lastSeen).fromNow();
              let isChecked = clientState[item.id] === true;
              if (action === 'getIssues' || action === 'deselect-all') {
                isChecked = false;
              }
              if (action === 'select-all') {
                isChecked = true;
              }
              const textDecoration = item.status === 'resolved' ? 'line-through' : '';
              console.log('assignedddTo:', assignedTo)

              return htm`
                <Box display="flex" justifyContent="space-between" flexDirection="column" border="1px solid #eaeaea" borderRadius="5px" padding="16px" margin="8px 0">
                  <Box display="flex" justifyContent="space-between">
                    <Box display="flex" flexDirection="row" overflow="hidden">
                      <Box marginRight="8px">
                        <Checkbox name="${item.id}" checked="${isChecked}" />
                      </Box>
                      <Box overflow="hidden">
                        <Link href="${item.permalink}?project=${item.project.id}&query=is%3Aunresolved" target="_blank">
                          <Box display="flex">
                            <Box color="#067df7" fontWeight="bold" marginRight="5px" textDecoration="${textDecoration}">${item.metadata.type}</Box>
                            <Box color="black" overflow="hidden" textOverflow="ellipsis" textDecoration="${textDecoration}">${item.culprit}</Box>
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
                    </Box>
                    <Box display="flex">
                      <Box width="64px" display="flex" justifyContent="center" alignItems="center">
                        ${item.count}
                      </Box>
                      <Box width="64px" display="flex" justifyContent="center" alignItems="center">
                        ${item.userCount}
                      </Box>

                      <Box width="64px" display="flex" justifyContent="center" alignItems="center">
                        <Select name="${item.id}-assignedTo" value="${assignedTo}" action="assignTo">
                          <Option value="noone" caption="No One" />
                          ${members.map((member, index) => {
                            return htm`
                              <Option value="${member.user.id}" caption="${member.user.name}" />
                            `
                          })}
                        </Select>
                      </Box>

                    </Box>
                  </Box>
                </Box>
              `
            }
            return htm`<Box />`
          })}
        </FsContent>
        <FsFooter>
          <Box display="flex" justifyContent="space-between" width="100%">
            <Box display="flex" alignItems="center">
              Page: ${page} / ${Math.max(Math.ceil(data.length / itemsPerPage), 1)}
            </Box>
            <Box>
              <Button action="prev-page" disabled="${page === 1}">prev</Button>
              <Button action="next-page" disabled="${page * itemsPerPage >= data.length}">next</Button>
            </Box>
          </Box>
        </FsFooter>
      </Fieldset>
    </Container>
  `
};
