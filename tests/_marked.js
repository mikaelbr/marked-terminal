import * as m from 'marked';

m.use({
  mangle: false,
  headerIds: false
});

export default 'marked' in m ? m.marked : m.default;
