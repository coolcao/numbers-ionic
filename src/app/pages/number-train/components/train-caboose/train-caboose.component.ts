import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-train-caboose',
  standalone: false,
  templateUrl: './train-caboose.component.html',
  styleUrls: ['./train-caboose.component.css'],
})
export class TrainCabooseComponent implements OnInit {

  @Input() number = 3;

  constructor() { }

  ngOnInit() { }

}
