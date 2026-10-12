import { equal } from 'assert';
import { markedTerminal } from '../index.js';
import marked, { resetMarked } from './_marked.js';

var identity = function (o) {
  return o;
};

function stripTermEsc(str) {
  return str.replace(/\u001b\[\d{1,2}m/g, '');
}

var debugOptions = {
  strong: (text) => `[STRONG:${text}]`,
  em: (text) => `[EM:${text}]`,
  codespan: (text) => `[CODE:${text}]`,
  del: (text) => `[DEL:${text}]`,
  listitem: identity
};

function markupWithDebug(str) {
  marked.use(markedTerminal(debugOptions));
  return stripTermEsc(marked(str));
}

describe('Inline Formatting in Lists', function () {
  beforeEach(function () {
    resetMarked();
  });

  it('should render bold text in list items', function () {
    const markdown = '1. **bold text** in list';
    const actual = markupWithDebug(markdown);
    const expected = '    1. [STRONG:bold text] in list\n\n';
    equal(actual, expected);
  });

  it('should render italic text in list items', function () {
    const markdown = '* _italic text_ in list';
    const actual = markupWithDebug(markdown);
    const expected = '    * [EM:italic text] in list\n\n';
    equal(actual, expected);
  });

  it('should render mixed formatting in list items', function () {
    const markdown = '1. **bold** and _italic_ text';
    const actual = markupWithDebug(markdown);
    const expected = '    1. [STRONG:bold] and [EM:italic] text\n\n';
    equal(actual, expected);
  });

  it('should render code spans in list items', function () {
    const markdown = '* `code` in list';
    const actual = markupWithDebug(markdown);
    const expected = '    * [CODE:code] in list\n\n';
    equal(actual, expected);
  });

  it('should render strikethrough in list items', function () {
    const markdown = '- ~~deleted text~~ in list';
    const actual = markupWithDebug(markdown);
    const expected = '    * [DEL:deleted text] in list\n\n';
    equal(actual, expected);
  });

  it('should render complex inline formatting in list items', function () {
    const markdown = '1. **bold** _italic_ `code` ~~strike~~';
    const actual = markupWithDebug(markdown);
    const expected = '    1. [STRONG:bold] [EM:italic] [CODE:code] [DEL:strike]\n\n';
    equal(actual, expected);
  });

  it('should render inline formatting in multiple list items', function () {
    const markdown = `1. **first** item
2. _second_ item
3. \`third\` item`;
    const actual = markupWithDebug(markdown);
    const expected = '    1. [STRONG:first] item\n    2. [EM:second] item\n    3. [CODE:third] item\n\n';
    equal(actual, expected);
  });

  it('should render inline formatting in unordered lists', function () {
    const markdown = `* **bold** item
* _italic_ item
* \`code\` item`;
    const actual = markupWithDebug(markdown);
    const expected = '    * [STRONG:bold] item\n    * [EM:italic] item\n    * [CODE:code] item\n\n';
    equal(actual, expected);
  });

  it('should preserve existing functionality for plain text lists', function () {
    const markdown = `1. plain text
2. more plain text`;
    const actual = markupWithDebug(markdown);
    const expected = '    1. plain text\n    2. more plain text\n\n';
    equal(actual, expected);
  });
});