var marked = require('marked');
var chalk = require('chalk');
var TerminalRenderer = require('../');

marked.setOptions({
  // Define custom renderer
  renderer: new TerminalRenderer({
    reflowText: true,
    width: 60
  })
});

// Show the parsed data
console.log(marked('# Hello with a very long title which should be reflowed atleast once \n\n---\n\nThis is **markdown** printed in the `terminal` and with a very long sentence. Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry\'s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.'));
