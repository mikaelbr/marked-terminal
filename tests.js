
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

describe('Renderer', function () {
  var r = new Renderer(defaultOptions);

  marked.setOptions({
    renderer: r
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