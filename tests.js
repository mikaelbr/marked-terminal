
var assert = require('assert');
var Renderer = require('./');
var marked = require('marked');


var identity = function (o) {
  return o;
};

var opts = [
  'code', 'blockquote', 'html', 'heading',
  'firstHeading', 'hr', 'listitem', 'table',
  'paragraph', 'strong', 'em', 'codespan',
  'del', 'link', 'href'
];

var defaultOptions = {};
opts.forEach(function (opt) {
  defaultOptions[opt] = identity;
});

defaultOptions.tableOptions = {
  chars: { 'top': '@@@@TABLE@@@@@' }
}

describe('Renderer', function () {
  var r = new Renderer(defaultOptions);

  marked.setOptions({
    renderer: r
  });

  it('should render links', function () {
    var text = '[Google](http://google.com)';
    var expected = 'Google (http://google.com)';
    assert.equal(marked(text).trim(), expected);
  });

  it('should pass on options to table', function () {
    var text = '| Lorem | Ipsum | Sit amet     | Dolar  |\n' +
    '|------|------|----------|----------|\n' +
    '| Row 1  | Value    | Value  | Value |\n' +
    '| Row 2  | Value    | Value  | Value |\n' +
    '| Row 3  | Value    | Value  | Value |\n' +
    '| Row 4  | Value    | Value  | Value |';

    assert.equal(marked(text).indexOf('@@@@TABLE@@@@@') !== -1, true);
  });

  it('should not show link href twice if link and url is equal', function () {
    var text = 'http://google.com';
    assert.equal(marked(text).trim(), text);
  });

  it('should render html as html', function () {
    var html = '<strong>foo</strong>';
    assert.equal(marked(html).trim(), html);
  });

  it('should not escape entities', function () {
    var text = '# This < is "foo". it\'s a & string\n' +
      '> This < is "foo". it\'s a & string\n\n' +
      'This < is **"foo"**. it\'s a & string\n' +
      'This < is "foo". it\'s a & string';

    var expected = '# This < is "foo". it\'s a & string\n\n' +
      '   This < is "foo". it\'s a & string\n\n' +
      'This < is "foo". it\'s a & string\n' +
      'This < is "foo". it\'s a & string';
    assert.equal(marked(text).trim(), expected);
  });
});