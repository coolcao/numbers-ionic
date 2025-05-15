export enum LearnMode {
  Starter = 'starter',
  // Intermediate = 'intermediate',
  Advanced = 'advanced',
}


// 入门模式0~9个数字的具体信息
export interface StarterNumberInfo {
  desc: string; // 数字的描述信息
  descImg: string;  // 数字的图片
  meaningAudio: string;// 数字的含义语音
  meaningImg: string; // 数字的含义图片
}
