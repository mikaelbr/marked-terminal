import * as m from 'marked';

if ('use' in m) {
  // Test wrapper to handle v5 with breaking changes
  m.use({
    mangle: false,
    headerIds: false
  });
}

export default 'marked' in m ? m.marked : m.default;
