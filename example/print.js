var marked = require('marked');
var chalk = require('chalk');
var TerminalRenderer = require('../');

marked.setOptions({
  // Define custom renderer
  renderer: new TerminalRenderer({

    // Change style for code
    codespan: chalk.underline.magenta,

    // Can also override color/styling by own functions.
    firstHeading: function (text) {
      return '*** ' + text;
    }
  })
});

// Show the parsed data
console.log(marked('# Hello \n\nThis is **markdown** printed in the `terminal`'));
