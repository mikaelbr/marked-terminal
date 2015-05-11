
var assert = require('assert');
var Renderer = require('../');
var marked = require('marked');

describe('Terminal escape', function () {
  var r = new Renderer();

  it('should not be included in text length', function () {
    var tokens = [
      "\u001b[38;5;128mfoo\u001b[0m",
      "\u001b[33mfoo\u001b[22m\u001b[24m\u001b[39m",
      "\u001b[35m\u001b[4m\u001b[1mfoo",
      "\u001b[33mfo\u001b[39mo\u001b[0m"
    ]
    tokens.forEach(function (token) {
      assert.equal(r.textLength(token), 3)
    });
  });
});
