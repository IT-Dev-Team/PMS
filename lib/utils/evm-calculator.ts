// lib/utils/evm-calculator.ts
import { Project } from '@/types/project';

export class EVMCalculator {
  
  // ========== PLANNED VALUE (PV) ==========
  static calculatePV(project: Project, totalBudget: number): number {
    const now = new Date();
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    
    if (totalDays <= 0 || elapsedDays <= 0) return 0;
    
    const plannedProgress = Math.min(elapsedDays / totalDays, 1);
    return totalBudget * plannedProgress;
  }

  // ========== EARNED VALUE (EV) ==========
  static calculateEV(project: Project, totalBudget: number): number {
    const percentComplete = (project.percentComplete || 0) / 100;
    return totalBudget * percentComplete;
  }

  // ========== COST PERFORMANCE INDEX (CPI) ==========
  static calculateCPI(ev: number, ac: number): number {
    if (ac === 0) return 1;
    return ev / ac;
  }

  // ========== SCHEDULE PERFORMANCE INDEX (SPI) ==========
  static calculateSPI(ev: number, pv: number): number {
    if (pv === 0) return 1;
    return ev / pv;
  }

  // ========== ESTIMATE AT COMPLETION (EAC) ==========
  static calculateEAC(ac: number, ev: number, bac: number): number {
    const cpi = this.calculateCPI(ev, ac);
    if (cpi === 0) return bac;
    return bac / cpi;
  }

  // ========== ESTIMATE TO COMPLETE (ETC) ==========
  static calculateETC(ac: number, ev: number, bac: number): number {
    const eac = this.calculateEAC(ac, ev, bac);
    return eac - ac;
  }

  // ========== VARIANCE AT COMPLETION (VAC) ==========
  static calculateVAC(bac: number, ev: number, ac: number): number {
    const eac = this.calculateEAC(ac, ev, bac);
    return bac - eac;
  }

  // ========== TO COMPLETE PERFORMANCE INDEX (TCPI) ==========
  static calculateTCPI(bac: number, ev: number, ac: number): number {
    const remainingWork = bac - ev;
    const remainingFunds = bac - ac;
    if (remainingFunds === 0) return 1;
    return remainingWork / remainingFunds;
  }

  // ========== EARNED SCHEDULE (ES) ==========
  static calculateEarnedSchedule(ev: number, pv: number, totalDays: number): number {
    if (pv === 0) return 0;
    return (ev / pv) * totalDays;
  }
}