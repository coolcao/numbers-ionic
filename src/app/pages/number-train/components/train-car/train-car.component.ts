import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-train-car',
  standalone: false,
  templateUrl: './train-car.component.html',
  styleUrls: ['./train-car.component.css'],
})
export class TrainCarComponent implements OnInit {
  @Input() number = 2;
  constructor() { }

  ngOnInit() { }

}
