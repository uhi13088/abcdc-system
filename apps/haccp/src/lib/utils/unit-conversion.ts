// 단위 타입 정의
export type UnitType = 'weight' | 'volume' | 'count';

export type WeightUnit = 'kg' | 'g';
export type VolumeUnit = 'L' | 'mL';
export type CountUnit = 'ea' | 'box' | 'pack' | 'roll';

export type Unit = WeightUnit | VolumeUnit | CountUnit;

// 단위별 환산 정보
export const UNIT_CONFIG: Record<UnitType, {
  base: string;
  units: Record<string, number>;
  displayThreshold: number; // 이 값 이상이면 큰 단위로 표시
}> = {
  weight: {
    base: 'g',
    units: {
      kg: 1000,
      g: 1,
    },
    displayThreshold: 1000, // 1000g 이상이면 kg으로 표시
  },
  volume: {
    base: 'mL',
    units: {
      L: 1000,
      mL: 1,
    },
    displayThreshold: 1000, // 1000mL 이상이면 L로 표시
  },
  count: {
    base: 'ea',
    units: {
      ea: 1,
      box: 1, // box는 제품별로 다를 수 있음
      pack: 1,
      roll: 1,
    },
    displayThreshold: Infinity, // 항상 입력한 단위로 표시
  },
};

// 단위로부터 단위 타입 추론
export function getUnitType(unit: string): UnitType {
  if (unit === 'kg' || unit === 'g') return 'weight';
  if (unit === 'L' || unit === 'mL') return 'volume';
  return 'count';
}

// 입력값 → 기본단위 변환 (kg→g, L→mL)
export function toBaseUnit(value: number, unit: string): number {
  const unitType = getUnitType(unit);
  const config = UNIT_CONFIG[unitType];
  const multiplier = config.units[unit] || 1;
  return value * multiplier;
}

// 기본단위 → 입력단위로 변환 (g→kg, mL→L)
export function fromBaseUnit(baseValue: number, targetUnit: string): number {
  const unitType = getUnitType(targetUnit);
  const config = UNIT_CONFIG[unitType];
  const multiplier = config.units[targetUnit] || 1;
  return baseValue / multiplier;
}

// 기본단위 → 보기 좋은 단위로 자동 변환
export function toDisplayUnit(baseValue: number, unitType: UnitType): { value: number; unit: string } {
  const config = UNIT_CONFIG[unitType];

  if (unitType === 'weight') {
    if (baseValue >= config.displayThreshold) {
      return { value: baseValue / 1000, unit: 'kg' };
    }
    return { value: baseValue, unit: 'g' };
  }

  if (unitType === 'volume') {
    if (baseValue >= config.displayThreshold) {
      return { value: baseValue / 1000, unit: 'L' };
    }
    return { value: baseValue, unit: 'mL' };
  }

  return { value: baseValue, unit: 'ea' };
}

// 숫자 포맷팅 (소수점 처리)
export function formatQuantity(value: number, decimals: number = 2): string {
  // 정수면 정수로 표시
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  // 소수점 이하가 있으면 지정된 자릿수까지 표시
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

// 단위 포함 표시
export function formatWithUnit(baseValue: number, unitType: UnitType): string {
  const display = toDisplayUnit(baseValue, unitType);
  return `${formatQuantity(display.value)} ${display.unit}`;
}

// 두 단위 간 변환 (예: kg → g, L → mL)
export function convertUnit(value: number, fromUnit: string, toUnit: string): number {
  const fromType = getUnitType(fromUnit);
  const toType = getUnitType(toUnit);

  // 같은 타입이 아니면 변환 불가
  if (fromType !== toType) {
    console.warn(`Cannot convert between different unit types: ${fromUnit} to ${toUnit}`);
    return value;
  }

  // 기본 단위로 변환 후 목표 단위로 변환
  const baseValue = toBaseUnit(value, fromUnit);
  return fromBaseUnit(baseValue, toUnit);
}

// 단위 선택 옵션
export const UNIT_OPTIONS: Record<UnitType, { value: string; label: string }[]> = {
  weight: [
    { value: 'kg', label: 'kg' },
    { value: 'g', label: 'g' },
  ],
  volume: [
    { value: 'L', label: 'L (리터)' },
    { value: 'mL', label: 'mL (밀리리터)' },
  ],
  count: [
    { value: 'ea', label: 'ea (개)' },
    { value: 'box', label: 'box (박스)' },
    { value: 'pack', label: 'pack (팩)' },
    { value: 'roll', label: 'roll (롤)' },
  ],
};

// 모든 단위 옵션
export const ALL_UNIT_OPTIONS = [
  { value: 'kg', label: 'kg', type: 'weight' },
  { value: 'g', label: 'g', type: 'weight' },
  { value: 'L', label: 'L', type: 'volume' },
  { value: 'mL', label: 'mL', type: 'volume' },
  { value: 'ea', label: 'ea', type: 'count' },
  { value: 'box', label: 'box', type: 'count' },
  { value: 'pack', label: 'pack', type: 'count' },
  { value: 'roll', label: 'roll', type: 'count' },
];

// 호환되는 단위인지 확인
export function areUnitsCompatible(unit1: string, unit2: string): boolean {
  return getUnitType(unit1) === getUnitType(unit2);
}
