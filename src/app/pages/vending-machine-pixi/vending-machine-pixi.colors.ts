export interface VendingMachineColors {
  body: number;
  shadow: number;
  glass: number;
  shelf: number;
  panel: number;
  walletBg: number;
  walletBorder: number;
  textHighlight: number;
  headerBg: number;
  headerText: number;
  tagBg: number;
  tagText: number;
  toyStroke: number;
}

export const VENDING_MACHINE_COLORS = {
  dark: {
    body: 0xC62828,
    shadow: 0x000000,
    glass: 0x3D5666,
    shelf: 0x4D5656,
    panel: 0x17202A,
    walletBg: 0x1C2833,
    walletBorder: 0x5D0F0A,
    textHighlight: 0x95A5A6,
    headerBg: 0x2C3E50,
    headerText: 0xE74C3C,
    tagBg: 0x2C3E50,
    tagText: 0xECF0F1,
    toyStroke: 0x95A5A6
  } satisfies VendingMachineColors,
  light: {
    body: 0xE84118,
    shadow: 0x000000,
    glass: 0xDFF9FB,
    shelf: 0x95A5A6,
    panel: 0x2F3640,
    walletBg: 0xFFFFFF,
    walletBorder: 0xE17055,
    textHighlight: 0xFFFFFF,
    headerBg: 0xFFFFFF,
    headerText: 0xE84118,
    tagBg: 0xFFFFFF,
    tagText: 0x000000,
    toyStroke: 0xFFFFFF
  } satisfies VendingMachineColors
};
