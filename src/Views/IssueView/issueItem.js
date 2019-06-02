const { htm } = require('@zeit/integration-utils');
const moment = require('moment');
const { Actions } = require('../../Actions');

module.exports = (props) => {
  const {
    action,
    clientState,
    item,
    members,
  } = props;

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
              ${members.map((member) => {
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
};
