export interface TrainPart {
  id: string;
  number: number;
  type: 'engine' | 'car' | 'caboose';
  x?: number;
  y?: number;
}
