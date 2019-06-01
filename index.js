const {withUiHook, htm} = require('@zeit/integration-utils');
var moment = require('moment');
const mockData = require('./mockData');
const issueView = require('./issueView');
const data = mockData();

const store = {
  secretId: '',
  secretKey: ''
};

const itemsPerPage = 10;
let page = 1;

module.exports = withUiHook(async ({payload}) => {
  const {clientState, action} = payload;
  if (action === 'view') {
    page = 1;
  }

  if (action === 'submit') {
    store.secretId = clientState.secretId;
    store.secretKey = clientState.secretKey;
  }

  if (action === 'reset') {
    store.secretId = '';
    store.secretKey = '';
  }

  if (action === 'next-page') {
    if (page * itemsPerPage < data.length) {
      page++;
    }
  }

  if (action === 'prev-page') {
    if ( page > 1) {
      page --;
    }
  }
  const IssueView = issueView({ page, itemsPerPage, data })

  return htm`
    <Page>
      ${IssueView}
    </Page>
  `
});

      // <Container>
      //   <Input label="Secret Id" name="secretId" value=${store.secretId} />
      //   <Input label="Secret Key" name="secretKey" value=${store.secretKey} />
      // </Container>
      // <Container>
      //   <Button action="submit">Submit</Button>
      //   <Button action="reset">Reset</Button>
      // </Container>
