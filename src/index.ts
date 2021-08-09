import _ from 'lodash';

when.onEvent = (_evt) => {
  const name = _.get(globals, 'currentLogin.prettyName', 'default');
  platform.log(_.join(['Hello', 'webpack', name], ' '));
}