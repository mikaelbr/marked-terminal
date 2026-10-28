import { marked } from 'marked';
import { markedTerminal } from '../src/index.ts';

marked.use(markedTerminal({ reflowText: true, width: 60 }));

console.log(
  marked.parse(
    "# Hello with a very long title which should be reflowed atleast once \n\n---\n\nThis is **markdown** printed in the `terminal` and with a very long sentence. Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged.\n\n| Option | Description | Default |\n|--------|-------------|---------|\n| `reflowText` | Wraps paragraphs and shrinks tables wider than `width` to fit the terminal | `false` |\n| `width` | Maximum width used when reflowing text and tables | `80` |"
  )
);
