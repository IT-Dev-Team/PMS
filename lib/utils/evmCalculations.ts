// lib/utils/evmCalculations.ts
import { EVMCalculator } from './evm-calculator';

export function calculateEVM(params: {
  budget: number;
  startDate?: string | Date;
  endDate?: string | Date;
  actualCost?: number;
  percentComplete?: number;
}) {
  const budget = params.budget || 0;
  const actualCost = params.actualCost || 0;
  const percentComplete = params.percentComplete || 0;

  let plannedValue = 0;
  if (params.startDate && params.endDate) {
    const start = new Date(params.startDate).getTime();
    const end = new Date(params.endDate).getTime();
    const now = Date.now();
    if (end > start) {
      const elapsed = Math.max(0, Math.min(now - start, end - start));
      plannedValue = budget * (elapsed / (end - start));
    }
  }

  const earnedValue = budget * (percentComplete / 100);
  const cpi = actualCost > 0 ? earnedValue / actualCost : 1;
  const spi = plannedValue > 0 ? earnedValue / plannedValue : 1;
  const cv = earnedValue - actualCost;
  const sv = earnedValue - plannedValue;
  const eac = cpi > 0 ? budget / cpi : budget;
  const etc = Math.max(0, eac - actualCost);
  const vac = budget - eac;
  const tcpi = (budget - earnedValue) > 0 && (budget - actualCost) > 0 
    ? (budget - earnedValue) / (budget - actualCost) 
    : 1;

  return {
    plannedValue,
    pv: plannedValue,
    earnedValue,
    ev: earnedValue,
    actualCost,
    ac: actualCost,
    cpi: Number(cpi.toFixed(2)),
    spi: Number(spi.toFixed(2)),
    cv: Number(cv.toFixed(2)),
    sv: Number(sv.toFixed(2)),
    eac: Number(eac.toFixed(2)),
    etc: Number(etc.toFixed(2)),
    vac: Number(vac.toFixed(2)),
    tcpi: Number(tcpi.toFixed(2)),
  };
}

export { EVMCalculator };
export default calculateEVM;
