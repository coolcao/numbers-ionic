import { animate, keyframes, state, style, transition, trigger } from "@angular/animations";

export const learnNumbersAnimations = [
  trigger('numberAnimation', [
    state('default', style({
      transform: 'scale(1)',
    })),
    state('playing', style({
      transform: 'scale(1.1)',
    })),
    transition('default => playing', [
      animate('0.5s', keyframes([
        style({ transform: 'scale(1)', offset: 0 }),
        style({ transform: 'scale(1.2)', offset: 0.3 }),
        style({ transform: 'scale(1)', offset: 1 })
      ]))
    ]),
    transition('playing => default', [
      animate('0.3s')
    ])
  ]),
];
