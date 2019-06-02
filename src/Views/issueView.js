const {withUiHook, htm} = require('@zeit/integration-utils');
const moment = require('moment');
const { Actions } = require('../Actions');

const issueFilterer = (item, clientState) => {
  let inFilter = true;
  const { issueFilter } = clientState;
  if (issueFilter) {
    inFilter = false;
    if (item.culprit && item.culprit.toLowerCase().indexOf(issueFilter.toLowerCase()) > -1) {
      inFilter = true;
    }
    if (item.metadata.type && item.metadata.type.toLowerCase().indexOf(issueFilter.toLowerCase()) > -1) {
      inFilter = true;
    }
    if (item.metadata.value && item.metadata.value.toLowerCase().indexOf(issueFilter.toLowerCase()) > -1) {
      inFilter = true;
    }
  }
  return inFilter;
}

module.exports = (props) => {
  const {
    page,
    itemsPerPage,
    data,
    clientState,
    action,
    members,
    paginationLinks,
    issueSortByFilter,
    issueStatusFilter,
  } = props;

  const filteredIssues = data.filter(issue => issueFilterer(issue, clientState));

  const itemStart = (page - 1) * itemsPerPage + 1;
  const itemEnd = itemStart + itemsPerPage - 1 - (itemsPerPage - filteredIssues.length);
  let issueIndexes = `${itemStart} - ${itemEnd}`;
  if (filteredIssues.length === 0 ) {
    issueIndexes = '0';
  }

  return htm`
    <Container>
      <Button action="${Actions.SHOW_SETTINGS}">Update Settings</Button>
    </Container>
    <Container>
      <Fieldset>
        <FsContent>
          <Box display="flex" justifyContent="space-between" padding="16px 0" alignItems="center">
            <Box display="flex" flexDirection="row" alignItems="center">
              <Box marginRight="8px">Sort By:</Box>
              <Select name="issueSortByFilter" value="${issueSortByFilter}" action="${Actions.GET_ISSUES}">
                <Option value="priority" caption="Priority" />
                <Option value="new" caption="First Seen" />
                <Option value="date" caption="Last Seen" />
                <Option value="freq" caption="Frequency" />
              </Select>
              <Box marginLeft="8px" marginRight="8px">Status Filter:</Box>
              <Select name="issueStatusFilter" value="${issueStatusFilter}" action="${Actions.GET_ISSUES}">
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
                  <Button action="${Actions.CLEAR_FILTER}" secondary small>Clear</Button>
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
                <H1> Errors (${issueIndexes})</H1>
              </Box>
            </Box>
            <Button action="${Actions.GET_ISSUES}" small>Refresh</Button>
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" flexDirection="row" alignItems="center">
              <Box marginRight="8px">
                <Button action="${Actions.RESOLVE}" small secondary>Resolve Selected</Button>
              </Box>
              <Box marginRight="8px">
                <Button action="${Actions.UNRESOLVE}" small secondary>Unresolve Selected</Button>
              </Box>
              <Box marginRight="8px">
                <Button
                  action="${action === Actions.SELECT_ALL ? Actions.DESELECT_ALL: Actions.SELECT_ALL}"
                  secondary
                  small
                >
                   ${action === Actions.SELECT_ALL ? 'Deselect All': 'Select All'}
                </Button>
              </Box>
            </Box>
          </Box>
          ${filteredIssues.map((item, index) => {
            const assignedToId = `${item.id}:assign-to`;
            const assignedAction = `${item.id}:${Actions.ASSIGN_TO}`;
            let assignedToValue = '';
            if (item.assignedTo) {
              assignedToValue = item.assignedTo.id;
            }
            const imgURL = `https://s1.sentry-cdn.com/_static/df7081b5c6bb784faeea5116bd62b398/sentry/dist/${item.project.slug}.svg`
            const lastSeen = moment(item.lastSeen).fromNow();
            let isChecked = clientState[item.id] === true;
            if (action === Actions.GET_ISSUES || action === Actions.DESELECT_ALL) {
              isChecked = false;
            }
            if (action === Actions.SELECT_ALL) {
              isChecked = true;
            }
            if (action === Actions.RESOLVE || action === Actions.UNRESOLVE) {
              isChecked = false;
            }
            const textDecoration = item.status === 'resolved' ? 'line-through' : '';

            return htm`
              <Box position="relative" display="flex" justifyContent="space-between" flexDirection="column" border="1px solid #eaeaea" borderRadius="5px" padding="16px" margin="8px 0">
                <Box display="flex" justifyContent="space-between" flexWrap="wrap">
                  <Box display="flex" flexDirection="row" overflow="hidden" maxWidth="600px">
                    <Box marginRight="8px">
                      <Checkbox name="${item.id}" checked="${isChecked}" />
                    </Box>
                    <Box overflow="hidden">
                      <Link href="${item.permalink}?project=${item.project.id}&query=is%3Aunresolved" target="_blank">
                        <Box display="flex">
                          <Box color="#067df7" fontWeight="bold" marginRight="5px" textDecoration="${textDecoration}">${item.metadata.type}</Box>
                          <Box color="black" overflow="hidden" textOverflow="ellipsis" textDecoration="${textDecoration}" wordBreak="break-all">
                            ${item.culprit}
                          </Box>
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
                    <Box display="flex" justifyContent="center" alignItems="center">
                      <Select name="${assignedToId}" value="${assignedToValue}" action="${assignedAction}">
                        <Option value="" caption="No One" />
                        ${members.map((member, index) => {
                          return htm`
                            <Option value="${member.user.id}" caption="${member.user.name}" />
                          `
                        })}
                      </Select>
                    </Box>
                  </Box>
                </Box>
                <Box
                  alignItems="center"
                  backgroundColor="rgb(234, 234, 234)"
                  borderTopLeftRadius="5px"
                  bottom="0"
                  display="flex"
                  right="0"
                  justifyContent="center"
                  width="64px"
                  zIndex="1"
                  position="absolute"
                >
                  ${item.count}
                </Box>
              </Box>
            `
          })}
        </FsContent>
        <FsFooter>
          <Box display="flex" justifyContent="space-between" width="100%">
            <Box display="flex" alignItems="center">
              Issues: ${issueIndexes}
            </Box>
            <Box>
              <Button action="${Actions.PREV_PAGE}" disabled="${!paginationLinks.prevLink || page === 1}">prev</Button>
              <Button action="${Actions.NEXT_PAGE}" disabled="${!paginationLinks.nextLink}">next</Button>
            </Box>
          </Box>
        </FsFooter>
      </Fieldset>
    </Container>
  `
};
