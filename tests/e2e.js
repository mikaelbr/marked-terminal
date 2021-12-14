import { equal } from 'assert';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import Renderer from '../index.js';
import { marked } from 'marked';
import { fileURLToPath } from 'url';

var identity = function (o) {
  return o;
};

function stripTermEsc(str) {
  return str.replace(/\u001b\[\d{1,2}m/g, '');
}

function getFixtureFile(fileName) {
  return readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/', fileName),
    {
      encoding: 'utf8'
    }
  );
}

var opts = [
  'code',
  'blockquote',
  'html',
  'heading',
  'firstHeading',
  'hr',
  'listitem',
  'table',
  'paragraph',
  'strong',
  'em',
  'codespan',
  'del',
  'link',
  'href'
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
    equal(actual, expected);
  });
});
