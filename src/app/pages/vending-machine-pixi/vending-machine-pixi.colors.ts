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
    body: 0x2C5E76,
    shadow: 0x000000,
    glass: 0x1B3F52,
    shelf: 0x5B7688,
    panel: 0x23324D,
    walletBg: 0x1B3F52,
    walletBorder: 0x7FD8F0,
    textHighlight: 0xE3F6FF,
    headerBg: 0x315B86,
    headerText: 0xFFD166,
    tagBg: 0xC7F9CC,
    tagText: 0x1F2937,
    toyStroke: 0xD9F2FF
  } satisfies VendingMachineColors,
  light: {
    body: 0x6EC6E8,
    shadow: 0x000000,
    glass: 0xEEF9FF,
    shelf: 0xC6E1EC,
    panel: 0x7A6CF6,
    walletBg: 0xEEF9FF,
    walletBorder: 0x2AC3F2,
    textHighlight: 0xFFFFFF,
    headerBg: 0xFFF1A6,
    headerText: 0xFF6B6B,
    tagBg: 0xC7F9CC,
    tagText: 0x1F2937,
    toyStroke: 0xFFFFFF
  } satisfies VendingMachineColors
};
