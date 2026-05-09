import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-output-block',
  standalone: true,
  template: `
    <article class="output-block">
      <h3>{{ title }}</h3>
      <pre>{{ content }}</pre>
    </article>
  `
})
export class OutputBlockComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) content = '';
}