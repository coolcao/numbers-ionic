import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-train-engine',
  standalone: false,
  templateUrl: './train-engine.component.html',
  styleUrls: ['./train-engine.component.css'],
})
export class TrainEngineComponent implements OnInit {

  @Input() number = 1;

  constructor() { }

  ngOnInit() { }

}
