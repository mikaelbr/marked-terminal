import * as m from 'marked';

export default 'marked' in m ? m.marked : m.default;
