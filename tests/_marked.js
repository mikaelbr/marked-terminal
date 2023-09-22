import * as m from 'marked';

const marked = 'marked' in m ? m.marked : m.default;

resetMarked();

export default marked;

export function resetMarked() {
  marked.setOptions(marked.getDefaults());

  if ('use' in marked) {
    // Test wrapper to handle v5 with breaking changes
    marked.use({
      mangle: false,
      headerIds: false
    });
  }
}
