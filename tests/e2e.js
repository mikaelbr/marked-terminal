
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var Renderer = require('../');
var marked = require('marked');


var identity = function (o) {
  return o;
};

function stripTermEsc (str) {
  return str.replace(/\u001b\[\d{1,2}m/g, "");
}

function getFixtureFile (fileName) {
  return fs.readFileSync(
    path.resolve(__dirname, 'fixtures/', fileName),
    { encoding: 'utf8' }
  );
}

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

function markup(str) {
  var r = new Renderer(defaultOptions);
  return stripTermEsc(marked(str, { renderer: r }));
}

describe('e2', function () {

  it('should render a document full of different supported syntax', function () {
    const actual = markup(getFixtureFile('e2e.md'));
    const expected = getFixtureFile('e2e.result.txt');
    assert.equal(actual, expected);
  });

});
