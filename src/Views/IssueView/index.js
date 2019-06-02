const { htm } = require('@zeit/integration-utils');
const moment = require('moment');
const { Actions } = require('../../Actions');
const issueItem = require('./issueItem');

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

  const itemStart = (page - 1) * itemsPerPage + 1;
  const itemEnd = itemStart + itemsPerPage - 1 - (itemsPerPage - data.length);
  let issueIndexes = `${itemStart} - ${itemEnd}`;
  if (data.length === 0 ) {
    issueIndexes = '0';
  }

  return htm`
    <Container>
      <Button action="${Actions.SHOW_SETTINGS}">Update Settings</Button>
    </Container>
    <Container>
      <Fieldset>
        <FsContent>
          <Box display="flex" justifyContent="space-between" padding="16px 0" alignItems="center" flexWrap="wrap">
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
              <Box marginRight="16px" display="flex" alignItems="center">
                <Input name="issueFilter" value="${clientState.issueFilter || ''}" />
              </Box>
              <Box marginRight="${clientState.issueFilter ? '16px' : ''}" display="flex" alignItems="center">
                <Button action="${Actions.GET_ISSUES}" secondary small>Search</Button>
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
          ${data.map((item) => {
            return htm`${issueItem({
              action,
              clientState,
              item,
              members,
            })}`
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
